import axios from 'axios';

const api = axios.create({
    baseURL: 'http://localhost:8080/api/v1', // URL của Spring Boot
    headers: {
        'Content-Type': 'application/json',
    }
});

api.interceptors.request.use((config) => {
    const token = sessionStorage.getItem('accessToken');
    if (token) config.headers.Authorization = `Bearer ${token}`;
    return config;
});

export default api;
