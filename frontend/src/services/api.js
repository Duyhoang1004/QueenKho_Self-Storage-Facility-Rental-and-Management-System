import axios from 'axios';

export const API_ORIGIN = 'http://localhost:8080';

const api = axios.create({
    baseURL: `${API_ORIGIN}/api/v1`, // URL của Spring Boot
    headers: {
        'Content-Type': 'application/json',
    }
});

api.interceptors.request.use((config) => {
    const token = sessionStorage.getItem('accessToken');
    if (token) config.headers.Authorization = `Bearer ${token}`;
    return config;
});

// PR-90: backend trả 401 khi token hết hạn (restart backend, đăng xuất ở tab khác, tài khoản bị khoá)
// → xoá phiên và đưa về trang đăng nhập, quay lại đúng trang đang đứng sau khi đăng nhập.
api.interceptors.response.use(
    (response) => response,
    (error) => {
        const status = error.response?.status;
        const url = error.config?.url || '';
        if (status === 401 && !url.includes('/auth/')) {
            sessionStorage.removeItem('accessToken');
            sessionStorage.removeItem('user');
            if (!window.location.pathname.startsWith('/login')) {
                const back = encodeURIComponent(window.location.pathname + window.location.search);
                const reason = error.response?.data?.error === 'ACCOUNT_LOCKED' ? 'locked' : 'expired';
                window.location.assign(`/login?${reason}=1&redirect=${back}`);
            }
        }
        return Promise.reject(error);
    }
);

export default api;
