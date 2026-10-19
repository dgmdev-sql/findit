FROM nginx:1.27-alpine

ARG BUILD_NUMBER=dev

COPY index.html /usr/share/nginx/html/index.html
COPY admin.html /usr/share/nginx/html/admin.html
COPY css/ /usr/share/nginx/html/css/
COPY js/ /usr/share/nginx/html/js/

# Stamp Jenkins build number into both portals
RUN sed -i "s/__BUILD_NUMBER__/${BUILD_NUMBER}/g" /usr/share/nginx/html/index.html /usr/share/nginx/html/admin.html

EXPOSE 80

HEALTHCHECK --interval=10s --timeout=5s --start-period=5s --retries=5 \
  CMD wget -q -O /dev/null http://127.0.0.1:80/ || exit 1
