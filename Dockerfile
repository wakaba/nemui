#FROM quay.io/wakaba/swchars
FROM quay.io/wakaba/suikacgi

CMD ["bash", "-c", "PORT=80 /server"]
