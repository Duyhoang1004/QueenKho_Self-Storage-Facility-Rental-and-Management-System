package com.queenkho.api.security;

import org.springframework.stereotype.Component;
import org.springframework.web.context.request.RequestAttributes;
import org.springframework.web.context.request.RequestContextHolder;

// PR-90: đọc người đang đăng nhập mà AccessControlFilter đã gắn vào request
@Component
public class CurrentUserProvider {

    // null nếu API công khai / gọi ngoài request (job)
    public CurrentUser current() {
        RequestAttributes attrs = RequestContextHolder.getRequestAttributes();
        if (attrs == null) {
            return null;
        }
        Object user = attrs.getAttribute(CurrentUser.REQUEST_ATTRIBUTE, RequestAttributes.SCOPE_REQUEST);
        return user instanceof CurrentUser currentUser ? currentUser : null;
    }

    public CurrentUser require() {
        CurrentUser user = current();
        if (user == null) {
            throw AccessException.unauthorized("Vui lòng đăng nhập lại");
        }
        return user;
    }
}
