package com.transli.mobilitycaptain.common.utils;

public class NetworkApiCallResponses {
    private int statusCode;
    private String responseBody;

    public NetworkApiCallResponses() {
    }

    public NetworkApiCallResponses(int statusCode, String responseBody) {
        this.statusCode = statusCode;
        this.responseBody = responseBody;
    }

    public int getStatusCode() {
        return statusCode;
    }

    public void setStatusCode(int statusCode) {
        this.statusCode = statusCode;
    }

    public String getResponseBody() {
        return responseBody;
    }

    public void setResponseBody(String responseBody) {
        this.responseBody = responseBody;
    }
}
