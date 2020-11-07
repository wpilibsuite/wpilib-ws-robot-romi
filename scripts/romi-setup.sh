echo "Downloading NVM..."
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.37.0/install.sh | bash

echo "Setting up NVM..."
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"

echo "Installing Node v14.15.0 LTS"
nvm install 14.15.0

echo "Installing WPILib WS Robot Romi package..."
npm install -g wpilib-ws-robot-romi


