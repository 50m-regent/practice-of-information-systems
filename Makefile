.PHONY: run clean build

# Go parameters
BINARY_NAME=music-app-api
BINARY_PATH=./cmd/api/main.go

run: build
	@echo "Starting the application..."
	@./bin/$(BINARY_NAME)

build:
	@echo "Building the application..."
	@mkdir -p ./bin # Ensure bin directory exists
	@go build -o ./bin/$(BINARY_NAME) $(BINARY_PATH)

clean:
	@echo "Cleaning up..."
	@go clean
	@rm -rf ./bin # Remove the bin directory

# TODO: Add targets for lint, test, migrate, seed
