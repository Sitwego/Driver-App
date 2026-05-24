package com.transli.mobilitycaptain.common.utils;

//import android.content.Context;
//import android.content.SharedPreferences;

import androidx.annotation.NonNull;

import java.io.BufferedReader;
//import java.io.DataOutputStream;
//import java.io.File;
//import java.io.FileInputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.io.OutputStreamWriter;
import java.net.HttpURLConnection;
import java.net.URL;
import java.security.KeyManagementException;
import java.security.NoSuchAlgorithmException;
//import java.util.HashMap;
//import java.util.UUID;
//
//import javax.net.ssl.HttpsURLConnection;
import java.util.Map;
import java.util.concurrent.TimeUnit;

import okhttp3.Call;
import okhttp3.Callback;
import okhttp3.MediaType;
import okhttp3.OkHttpClient;
import okhttp3.Request;
import okhttp3.RequestBody;
import okhttp3.Response;
import okhttp3.ResponseBody;
import okhttp3.logging.HttpLoggingInterceptor;

public class NetworkApiCalls {
    private static final String DEFAULT_API_METHOD = "POST";

    private static final MediaType JSON = MediaType.parse("application/json; charset=utf-8");
    private static volatile NetworkApiCalls instance;
    private final OkHttpClient client;

    // Private constructor
    private NetworkApiCalls() {
        client = new OkHttpClient().newBuilder()
                .connectTimeout(30, TimeUnit.SECONDS)
                .readTimeout(30, TimeUnit.SECONDS)
                .writeTimeout(30, TimeUnit.SECONDS)
                .addInterceptor(new HttpLoggingInterceptor().setLevel(HttpLoggingInterceptor.Level.NONE))
//                .addInterceptor(new HttpLoggingInterceptor().setLevel(
//                        BuildConfig.DEBUG ? HttpLoggingInterceptor.Level.BODY : HttpLoggingInterceptor.Level.NONE
//                ))
                .build();
    }
    public static NetworkApiCalls getInstance() {
        if (instance == null) {
            synchronized (NetworkApiCalls.class) {
                if (instance == null) {
                    instance = new NetworkApiCalls();
                }
            }
        }
        return instance;
    }

    public interface ApiCallback {
        void onSuccess(String response);
        void onFailure(Throwable throwable);
    }

    public void postData(String url, String json, String vc, String bearerToken, ApiCallback callback) {
        RequestBody body = RequestBody.create(json, JSON);
        Request request = new Request.Builder()
                .url(url)
                .post(body)
                .addHeader("vc", vc)
                .addHeader("Authorization", "Bearer " + bearerToken)
                .build();

        client.newCall(request).enqueue(new Callback() {
            @Override
            public void onFailure(@NonNull Call call, @NonNull IOException e) {
                callback.onFailure(e);
            }

            @Override
            public void onResponse(@NonNull Call call, @NonNull Response response) throws IOException {
                try (ResponseBody responseBody = response.body()) {
                    if (!response.isSuccessful()) {
                        callback.onFailure(new IOException("Unexpected code " + response.code()));
                        return;
                    }

                    if (responseBody != null) {
                        callback.onSuccess(responseBody.string());
                    } else {
                        callback.onFailure(new IOException("Empty response body"));
                    }
                } catch (Exception e) {
                    callback.onFailure(e);
                }
            }
        });
    }


    public static NetworkApiCallResponses callAPI(String endpoint) {
        return callAPI(endpoint, null, null, DEFAULT_API_METHOD, true);
    }

    public static NetworkApiCallResponses callAPI(String endpoint, Map<String, String> headers) {
        return callAPI(endpoint, headers, null, DEFAULT_API_METHOD, true);
    }

    public static NetworkApiCallResponses callAPI(String endpoint, Map<String, String> headers, String requestBody) {
        return callAPI(endpoint, headers, requestBody, DEFAULT_API_METHOD, true);
    }
    public static NetworkApiCallResponses callAPI(String endpoint, Map<String, String> headers, String requestBody, String apiMethod){
        return callAPI(endpoint, headers, requestBody, apiMethod, true);
    }

    public static NetworkApiCallResponses callAPI(String endpoint, Map<String, String> headers, String requestBody, String apiMethod, Boolean doOutput) {
        NetworkApiCallResponses defaultResp = new NetworkApiCallResponses();
        defaultResp.setResponseBody("");
        defaultResp.setStatusCode(-1);
        try {
            HttpURLConnection connection = callAPIConnection(endpoint, headers, requestBody, apiMethod, doOutput);
            int responseCode = connection.getResponseCode();

            NetworkApiCallResponses response = new NetworkApiCallResponses();
            response.setStatusCode(responseCode);
            response.setResponseBody(apiResponseBuilder(getResponseStream(connection)));
            return response;
        }catch (Exception e){
            e.printStackTrace();
            return defaultResp;
        }
    }


    public static InputStream getResponseStream(HttpURLConnection connection) throws IOException {
        int responseCode = connection.getResponseCode();
        InputStream responseStream;
        if (responseCode >= 200 && responseCode < 300) {
            responseStream = connection.getInputStream();
        } else {
            responseStream = connection.getErrorStream();
        }
        return responseStream;
    }

    public static HttpURLConnection callAPIConnection(String endpoint, Map<String, String> headers, String requestBody, String apiMethod, Boolean doOutput) throws IOException, NoSuchAlgorithmException, KeyManagementException {
        HttpURLConnection connection = (HttpURLConnection) (new URL(endpoint).openConnection());
//        if (connection instanceof HttpsURLConnection)
//            ((HttpsURLConnection) connection).setSSLSocketFactory(new TLSSocketFactory());

        connection.setRequestMethod(apiMethod);

        if (headers != null) {
            for (Map.Entry<String, String> entry : headers.entrySet()) {
                connection.setRequestProperty(entry.getKey(), entry.getValue());
            }
        }

        connection.setDoOutput(doOutput);

        if (requestBody != null) {

            OutputStreamWriter writer = new OutputStreamWriter(connection.getOutputStream());
            writer.write(requestBody);
            writer.flush();
            writer.close();
        }
        connection.connect();
        return connection;
    }

    private static String apiResponseBuilder(InputStream responseStream) {
        try {
            BufferedReader reader = new BufferedReader(new InputStreamReader(responseStream));
            StringBuilder responseBuilder = new StringBuilder();
            String line;
            while ((line = reader.readLine()) != null) {
                responseBuilder.append(line);
            }
            reader.close();
            return responseBuilder.toString();
        } catch (Exception e) {
            return "This happened - " + e;
        }

    }

}
