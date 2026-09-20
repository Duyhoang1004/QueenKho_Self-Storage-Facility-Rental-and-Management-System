import axios from 'axios';

const api = axios.create({
    baseURL: 'http://localhost:8080/api/v1', // URL của Spring Boot
    headers: {
        'Content-Type': 'application/json',
    }
});

export default api;