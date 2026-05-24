package com.transli.mobilitycaptain;
import android.content.Context;
import android.util.Log;

import com.google.gson.JsonObject;
import com.google.gson.JsonParser;
import com.google.gson.JsonSyntaxException;
import com.tencent.mmkv.MMKV;

import java.util.concurrent.TimeUnit;

import io.grpc.ManagedChannel;
import io.grpc.android.AndroidChannelBuilder;

public final class RpcChannelManager {
    private static volatile ManagedChannel channel;
    private static volatile String currentToken;
    private static volatile MMKV mmkv;

    // gRPC server URL is provided by AppConfig (BuildConfig default, overridable via Remote Config).
    
    private static final int KEEP_ALIVE_TIME_SEC = 30;
    private static final int KEEP_ALIVE_TIMEOUT_SEC = 30;
    private static final int IDLE_TIMEOUT_MIN = 5;
    private static final int MAX_RETRY_ATTEMPTS = 10;
    private static final int MAX_MESSAGE_SIZE = 16 * 1024 * 1024;
    private static final int SHUTDOWN_TIMEOUT_SEC = 5;

    public static void init() {
        synchronized (RpcChannelManager.class) {
            if (mmkv == null) {
                mmkv = MMKV.mmkvWithID("USER_DATA", MMKV.SINGLE_PROCESS_MODE);
            }
            if (currentToken == null) {
                loadTokenFromStorage();
            }
        }

    }

    /**
     * Get or create channel with current token
     */
    public static ManagedChannel getChannel(Context context) {
        if (context == null) {
            throw new IllegalArgumentException("Context cannot be null");
        }

        synchronized (RpcChannelManager.class) {
            // Ensure token is loaded
            if (currentToken == null) {
                if (!loadTokenFromStorage()) {
                    Log.e("RpcChannelManager", "Failed to load token");
                    return null;
                }
            }

            // Check if channel needs recreation
            boolean needsNewChannel = !isChannelHealthyInternal();

            // If channel exists but token might have changed
            if (channel != null) {
                String latestToken = getLatestTokenFromStorage();
                if (latestToken != null && !latestToken.equals(currentToken)) {
                    Log.d("RpcChannelManager", "Token changed, recreating channel");
                    needsNewChannel = true;
                    currentToken = latestToken;
                }
            }

            if (needsNewChannel) {
                shutdownChannelInternal(); // Don't clear token

                try {
                    channel = AndroidChannelBuilder.forTarget(AppConfig.getGrpcServerUrl())
                            .intercept(new GRPCNotificationHeaderInterceptor(currentToken))
                            .enableRetry()
                            .maxRetryAttempts(MAX_RETRY_ATTEMPTS)
                            .keepAliveTime(KEEP_ALIVE_TIME_SEC, TimeUnit.SECONDS)
                            .keepAliveTimeout(KEEP_ALIVE_TIMEOUT_SEC, TimeUnit.SECONDS)
                            .idleTimeout(IDLE_TIMEOUT_MIN, TimeUnit.MINUTES)
                            .maxInboundMessageSize(MAX_MESSAGE_SIZE)
                            .context(context.getApplicationContext())
                            .build();

                    Log.d("RpcChannelManager", "Created new channel");

                } catch (Exception e) {
                    Log.e("RpcChannelManager", "Failed to create gRPC channel", e);
                    throw new RuntimeException("Failed to initialize gRPC channel", e);
                }
            }

            return channel;
        }
    }

    /**
     * Load token from storage
     * @return true if successful, false otherwise
     */
    private static synchronized boolean loadTokenFromStorage() {
        if (mmkv == null) {
            Log.e("RpcChannelManager", "MMKV not initialized");
            return false;
        }

        String userJson = mmkv.getString("user", null);
        if (userJson == null) {
            Log.w("RpcChannelManager", "No user data found in MMKV");
            return false;
        }

        try {
            JsonObject userObj = JsonParser.parseString(userJson).getAsJsonObject();
            JsonObject userData = userObj.get("data").getAsJsonObject();
            currentToken = userData.get("profile_id").getAsString();

            if (currentToken == null || currentToken.trim().isEmpty()) {
                Log.w("RpcChannelManager", "Token is empty");
                return false;
            }

            Log.d("RpcChannelManager", "Token loaded successfully");
            return true;

        } catch (JsonSyntaxException e) {
            Log.e("RpcChannelManager", "Invalid JSON format", e);
        } catch (NullPointerException e) {
            Log.e("RpcChannelManager", "Missing expected JSON fields", e);
        } catch (Exception e) {
            Log.e("RpcChannelManager", "Failed to parse user data", e);
        }

        return false;
    }

    /**
     * Get latest token without updating currentToken
     */
    private static synchronized String getLatestTokenFromStorage() {
        if (mmkv == null) return null;

        String userJson = mmkv.getString("user", null);
        if (userJson == null) return null;

        try {
            JsonObject userObj = JsonParser.parseString(userJson).getAsJsonObject();
            JsonObject userData = userObj.get("data").getAsJsonObject();
            return userData.get("profile_id").getAsString();
        } catch (Exception e) {
            return null;
        }
    }

    /**
     * Update token manually (e.g., after login)
     */
    public static synchronized void updateToken(String newToken) {
        if (newToken != null && !newToken.equals(currentToken)) {
            currentToken = newToken;
            // Channel will be recreated on next getChannel() call
        }
    }

    /**
     * Check if channel is healthy (caller must hold RpcChannelManager.class lock)
     */
    private static boolean isChannelHealthyInternal() {
        return channel != null &&
                !channel.isShutdown() &&
                !channel.isTerminated();
    }

    /**
     * Public check if channel is healthy
     */
    public static synchronized boolean isChannelHealthy() {
        return isChannelHealthyInternal();
    }

    /**
     * Shutdown channel but keep token
     */
    private static void shutdownChannelInternal() {
        if (channel != null) {
            try {
                channel.shutdown();
                if (!channel.awaitTermination(SHUTDOWN_TIMEOUT_SEC, TimeUnit.SECONDS)) {
                    channel.shutdownNow();
                }
            } catch (InterruptedException e) {
                channel.shutdownNow();
                Thread.currentThread().interrupt();
            } finally {
                channel = null;
                // Don't clear currentToken!
            }
        }
    }

    /**
     * Full shutdown - for logout scenarios
     */
    public static synchronized void shutdown() {
        shutdownChannelInternal();
//        currentToken = null;
    }

    /**
     * Drop the current channel so the next {@link #getChannel} call rebuilds it
     * against the URL now in {@link AppConfig}. Used when Remote Config delivers
     * a new gRPC server URL at runtime.
     */
    public static synchronized void resetChannel() {
        shutdownChannelInternal();
    }

    /**
     * Get current token (if loaded)
     */
    public static synchronized String getToken() {
        return currentToken;
    }
}

