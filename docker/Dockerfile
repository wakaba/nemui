FROM quay.io/wakaba/docker-perl-app-base

RUN echo "#!/bin/bash" > /command1 && \
    echo "echo Hello command1" >> /command1 &&
    chmod u+x /command1

CMD ["/command1"]

## License: Public Domain.
