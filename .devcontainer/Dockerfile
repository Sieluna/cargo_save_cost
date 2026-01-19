ARG VARIANT=forky-slim
FROM debian:${VARIANT}
ENV DEBIAN_FRONTEND=noninteractive

# Arguments
ARG CONTAINER_USER=mono
ARG CONTAINER_GROUP=mono
ARG NODE_VERSION=lts/*

# Install dependencies
RUN apt-get update \
    && apt-get install -y curl git \
    && apt-get clean -y && rm -rf /var/lib/apt/lists/* /tmp/library-scripts

# Set users
RUN adduser --disabled-password --gecos "" ${CONTAINER_USER}
USER ${CONTAINER_USER}
WORKDIR /home/${CONTAINER_USER}

# Install nvm
ENV NVM_DIR=/home/${CONTAINER_USER}/.nvm
RUN curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.3/install.sh | bash
RUN bash -c "source $NVM_DIR/nvm.sh && nvm install $NODE_VERSION"

# Install rustup
RUN curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y --profile minimal
ENV PATH=${PATH}:/home/${CONTAINER_USER}/.cargo/bin

CMD [ "/bin/bash" ]
