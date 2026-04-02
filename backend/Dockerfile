FROM alpine:latest

# Upgrade to 0.23.0 to support the _superusers collection
ARG PB_VERSION=0.23.0

RUN apk add --no-cache unzip ca-certificates

# Download and unzip PocketBase
ADD https://github.com/pocketbase/pocketbase/releases/download/v${PB_VERSION}/pocketbase_${PB_VERSION}_linux_amd64.zip /tmp/pb.zip
RUN unzip /tmp/pb.zip -d /pb/

# Create pb_data directory
RUN mkdir -p /pb/pb_data

# Copy the migrations directory into the container
COPY ./pb_migrations /pb/pb_migrations

EXPOSE 8090

# Start PocketBase
CMD ["/pb/pocketbase", "serve", "--http=0.0.0.0:8090"]