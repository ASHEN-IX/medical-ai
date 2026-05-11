"use client";
import axios from "axios";

const getApiBaseUrl = () => {
  if (typeof window !== "undefined") {
    // Dynamically use the hostname we are accessing from (e.g., 192.168.x.x)
    return `${window.location.protocol}//${window.location.hostname}:4000`;
  }
  return process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";
};

export const apiClient = axios.create({
  baseURL: getApiBaseUrl(),
  timeout: 20000,
  headers: {
    "Content-Type": "application/json",
  },
});

// Request interceptor: add auth token
apiClient.interceptors.request.use(
  (config) => {
    const token =
      typeof window !== "undefined" ? localStorage.getItem("accessToken") : null;
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor: handle 401
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (
      error.response?.status === 401 &&
      typeof window !== "undefined"
    ) {
      localStorage.removeItem("accessToken");
      localStorage.removeItem("user");
      window.location.href = "/login";
    }
    return Promise.reject(error);
  }
);
