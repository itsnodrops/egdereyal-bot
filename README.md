# LayerEdge Automation Bot

An automation tool designed to help users manage their LayerEdge light nodes efficiently with a convenient terminal-based dashboard interface.

## Features

- Secure Private Key Management
- Auto Node Activation & Ping
- Auto Claim Daily Rewards
- Points Tracking System
- Multi-wallet Support
- Interactive Terminal Dashboard
- Colored Status Indicators
- Pagination for Multiple Accounts

## Prerequisites

Before running the bot, make sure you have:

- Node.js (v16 or higher)
- npm (Node Package Manager)
- A LayerEdge account (register with referral code: `jjpr2nUS`)
- Wallet private keys for activation

## Registration

1. Visit [LayerEdge Dashboard](https://dashboard.layeredge.io)
2. Enter the referral code: `jjpr2nUS`
3. Connect your wallet and complete the registration
4. Start earning points by running a light node!

## Installation

1. Clone the repository:

```bash
git clone https://github.com/itsnodrops/egdereyal-bot.git
```

2. Navigate to the project directory:

```bash
cd egdereyal-bot
```

3. Install dependencies:

```bash
npm install
```

4. Configure your wallets:
   - Edit `.env` file in the root directory
   - ```bash
     mv .env.example .env && nano .env
     ```
   - Add your wallet private keys(separate with commas)
   - ```bash
     PRIVATE_KEYS=PrivateKey1,PrivateKeys2,PrivateKey3
     ```
     
## Usage

1. Start the bot:

```bash
node main.js
```

2. Controls:
   - ↑/↓: Navigate between wallets
   - ←/→: Change pages
   - Ctrl+C: Exit program

## Project Structure

```
egdereyal-bot/
├── main.js          # Main application file
├── .env             # Private keys configuration
├── package.json     # Project dependencies
└── config/
    ├── banner.js    # Dashboard banner configuration
    ├── colors.js    # Color scheme configuration
    └── ...
```

## Features Explained

### Secure Key Management

- Reads private keys from .env
- Automatically derives wallet addresses
- Secure signing for node activation

### Node Activation & Ping

- Automatic node status checking
- Signature-based node activation
- Signature-based claiming daily reward
- Continuous ping to maintain node status
- Configurable ping interval

### Status Monitoring

- Real-time status updates
- Points tracking
- Detailed error reporting
- Multiple status indicators:
  - 🔵 Starting: Initial setup
  - 🟡 Checking Status: Verifying node status
  - 🟣 Activating: Node activation in progress
  - 🟢 Active: Node running successfully
  - 🔴 Error: Error encountered
  - 🟢 Activated: Node activation successful

### Dashboard Interface

- Clean and intuitive terminal interface
- Real-time updates
- Color-coded status indicators
- Pagination for multiple wallets
- Error message display

## Support & Links

- Reference   : [https://codeberg.org/Galkurta](https://codeberg.org/Galkurta)
- GitHub      : [https://github.com/itsnodrops](https://codeberg.org/itsnodrops)
- Telegram    : [https://t.me/NoDrops](https://t.me/NoDrops)
- Referral Code: `jjpr2nUS`

## Security Notice

**Important**: Your private keys are sensitive information. Never share them with anyone and ensure `.env` is properly secured and not shared publicly.

## Contributing

Contributions are welcome! Please feel free to submit pull requests.

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Disclaimer

This bot is provided as-is, without any warranties. Users are responsible for their own actions and should use this tool responsibly. Never share your private keys and always verify the source code before running any automated tools.
