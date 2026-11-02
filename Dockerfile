# Bagisto prebuilt Docker image: PHP 8.4, Vue and Vite assets already compiled.
# Do not expose until persistent external DB, APP_KEY and secure admin credentials exist.
FROM webkul/bagisto:2.5.0-nginx-mysql
COPY theme/ /tmp/bakirmutfak/theme/
COPY tools/install-theme.php /tmp/bakirmutfak/tools/install-theme.php
COPY tools/xml-to-bagisto.php /usr/local/bin/bakirmutfak-xml.php
COPY config/tedarikci-ornek.json /usr/local/share/bakirmutfak/mapping.json
COPY tools/xml-to-bagisto.php /var/www/bagisto/tools/bm-xml-to-bagisto.php
COPY config/tedarikci-ornek.json /var/www/bagisto/config/bm-xml-mapping.json
RUN php /tmp/bakirmutfak/tools/install-theme.php /var/www/bagisto \
    && php -l /var/www/bagisto/config/themes.php \
    && php -l /var/www/bagisto/app/Providers/BakirMutfakXmlServiceProvider.php \
    && php -l /var/www/bagisto/app/Http/Controllers/Admin/BakirMutfakXmlController.php \
    && php -l /var/www/bagisto/resources/themes/bakirmutfak/views/home/index.blade.php \
    && php -l /var/www/bagisto/resources/themes/bakirmutfak/views/categories/view.blade.php \
    && php -l /var/www/bagisto/resources/themes/bakirmutfak/views/products/view.blade.php \
    && rm -rf /tmp/bakirmutfak
ENV PORT=80 APP_ENV=production APP_DEBUG=false APP_TIMEZONE=Europe/Istanbul
EXPOSE 80
