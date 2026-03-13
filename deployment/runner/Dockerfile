# GitHub Actions Self-Hosted Runner
# Adapted for apoint/bookingApp

# =============================================================================
# STAGE 1: Builder - Download and verify binaries
# =============================================================================
FROM ubuntu:22.04 AS builder

ARG RUNNER_VERSION=2.331.0
ARG RUNNER_SHA256=5fcc01bd546ba5c3f1291c2803658ebd3cedb3836489eda3be357d41bfcf28a7

ENV DEBIAN_FRONTEND=noninteractive

RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /build

# Download and verify GitHub Actions Runner
RUN curl -fsSL -o actions-runner.tar.gz \
    "https://github.com/actions/runner/releases/download/v${RUNNER_VERSION}/actions-runner-linux-x64-${RUNNER_VERSION}.tar.gz" \
    && echo "${RUNNER_SHA256}  actions-runner.tar.gz" | sha256sum -c - \
    && mkdir -p /build/runner \
    && tar xzf actions-runner.tar.gz -C /build/runner \
    && rm actions-runner.tar.gz

# Download docker-compose standalone
RUN COMPOSE_VERSION=$(curl -fsSL https://api.github.com/repos/docker/compose/releases/latest | grep -oP '"tag_name": "\K[^"]+') \
    && curl -fsSL -o docker-compose \
    "https://github.com/docker/compose/releases/download/${COMPOSE_VERSION}/docker-compose-linux-x86_64" \
    && chmod 755 docker-compose

# =============================================================================
# STAGE 2: Runtime
# =============================================================================
FROM ubuntu:22.04 AS runtime

ARG RUNNER_UID=1000
ARG RUNNER_GID=1000

ENV DEBIAN_FRONTEND=noninteractive \
    RUNNER_ALLOW_RUNASROOT=0 \
    DOTNET_SYSTEM_GLOBALIZATION_INVARIANT=1

LABEL org.opencontainers.image.title="Apoint GitHub Actions Runner" \
      org.opencontainers.image.description="Self-hosted runner for apoint/bookingApp" \
      org.opencontainers.image.source="https://github.com/bernardodieta/bookingApp"

# Install runtime dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    git \
    jq \
    unzip \
    zip \
    sudo \
    ca-certificates \
    gnupg \
    locales \
    build-essential \
    && rm -rf /var/lib/apt/lists/* \
    && locale-gen en_US.UTF-8

# Install Node.js 20 LTS
RUN curl -fsSL https://deb.nodesource.com/setup_20.x | bash - \
    && apt-get install -y --no-install-recommends nodejs \
    && rm -rf /var/lib/apt/lists/* \
    && npm config set fund false \
    && npm config set update-notifier false

# Install Docker CLI (uses host Docker via socket mount)
RUN install -m 0755 -d /etc/apt/keyrings \
    && curl -fsSL https://download.docker.com/linux/ubuntu/gpg | gpg --dearmor -o /etc/apt/keyrings/docker.gpg \
    && chmod a+r /etc/apt/keyrings/docker.gpg \
    && echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu jammy stable" \
    > /etc/apt/sources.list.d/docker.list \
    && apt-get update \
    && apt-get install -y --no-install-recommends docker-ce-cli docker-buildx-plugin docker-compose-plugin \
    && rm -rf /var/lib/apt/lists/*

# Copy docker-compose standalone from builder
COPY --from=builder /build/docker-compose /usr/local/bin/docker-compose

# Create non-root runner user
RUN groupadd --gid ${RUNNER_GID} runner \
    && useradd --uid ${RUNNER_UID} --gid ${RUNNER_GID} --shell /bin/bash --create-home runner \
    && echo "runner ALL=(root) NOPASSWD: /bin/chown, /bin/chmod, /bin/cp" >> /etc/sudoers.d/runner \
    && chmod 0440 /etc/sudoers.d/runner

# Copy runner from builder
COPY --from=builder /build/runner /opt/actions-runner
RUN chmod -R 755 /opt/actions-runner

# Install runner dependencies
RUN /opt/actions-runner/bin/installdependencies.sh \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /home/runner/actions-runner

RUN chown -R runner:runner /home/runner /opt/actions-runner

COPY entrypoint.sh /entrypoint.sh
RUN chmod 755 /entrypoint.sh

# Remove setuid/setgid binaries
RUN find / -perm /6000 -type f -exec chmod a-s {} \; 2>/dev/null || true

ENV LANG=en_US.UTF-8 \
    LC_ALL=en_US.UTF-8 \
    HOME=/home/runner \
    PATH="/home/runner/.local/bin:${PATH}"

USER runner

HEALTHCHECK --interval=30s --timeout=10s --start-period=10s --retries=3 \
    CMD pgrep -f "Runner.Listener" > /dev/null || exit 1

ENTRYPOINT ["/entrypoint.sh"]
