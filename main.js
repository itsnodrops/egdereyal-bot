import fs from "fs/promises";
import axios from "axios";
import readline from "readline";
import { getBanner } from "./config/banner.js";
import { colors } from "./config/colors.js";
import { Wallet } from "ethers";
import dotenv from "dotenv";
dotenv.config();

const CONFIG = {
  PING_INTERVAL: 0.5,
  get PING_INTERVAL_MS() {
    return this.PING_INTERVAL * 60 * 1000;
  },
};

readline.emitKeypressEvents(process.stdin);
process.stdin.setRawMode(true);

class WalletDashboard {
  constructor() {
    this.wallets = [];
    this.selectedIndex = 0;
    this.currentPage = 0;
    this.walletsPerPage = 5;
    this.isRunning = true;
    this.pingIntervals = new Map();
    this.walletStats = new Map();
    this.privateKeys = new Map();
    this.renderTimeout = null;
    this.lastRender = 0;
    this.minRenderInterval = 100;
  }

  async initialize() {
    try {
      const privateKeys = process.env.PRIVATE_KEYS
        ? process.env.PRIVATE_KEYS.split(",").map((key) => key.trim())
        : [];

      if (privateKeys.length === 0) {
        throw new Error("No private keys found in .env");
      }

      this.wallets = [];
      this.privateKeys = new Map();

      for (let privateKey of privateKeys) {
        try {
          const wallet = new Wallet(privateKey);
          const address = wallet.address;
          this.wallets.push(address);
          this.privateKeys.set(address, privateKey);

          this.walletStats.set(address, {
            status: "Starting",
            lastPing: "-",
            points: 0,
            error: null,
          });

          this.startPing(address);
        } catch (error) {
          console.error(
            `Invalid private key: ${privateKey} - ${error.message}`
          );
        }
      }
    } catch (error) {
      console.error(`Error initializing wallets: ${error}`);
      process.exit(1);
    }
  }

  getApi() {
    return axios.create({
      baseURL: "https://referralapi.layeredge.io/api",
      headers: {
        Accept: "*/*",
        "Accept-Encoding": "gzip, deflate, br",
        "Accept-Language": "en-US,en;q=0.9",
        "Content-Type": "application/json",
        Origin: "https://dashboard.layeredge.io",
        Referer: "https://referralapi.layeredge.io/",
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
      },
      timeout: 30000,
      maxRetries: 20,
      retryDelay: 2000,
      retryCondition: (error) => {
        return axios.isNetworkError(error) || error.code === "ETIMEDOUT";
      },
    });
  }

  async checkNodeStatus(wallet, retries = 100, delay = 5000) {
    for (let attempt = 0; attempt < retries; attempt++) {
      try {
        const response = await this.getApi().get(
          `/light-node/node-status/${wallet}`
        );
        return response.data?.data?.startTimestamp !== null;
      } catch (error) {
        if (
          attempt < retries - 1 &&
          (error.response?.status === 502 || error.code === "ETIMEDOUT")
        ) {
          console.warn(
            `[Retry ${attempt + 1}] Node status check failed, retrying in ${
              delay / 1000
            }s...`
          );
          await new Promise((resolve) => setTimeout(resolve, delay));
        } else {
          throw new Error(`Check status failed: ${error.message}`);
        }
      }
    }
  }

  async checkWalletDetails(wallet, retries = 100, delay = 5000) {
    for (let attempt = 0; attempt < retries; attempt++) {
      try {
        const response = await this.getApi().get(
          `/referral/wallet-details/${wallet}`
        );
        return response.data?.data || {};
      } catch (error) {
        if (attempt < retries - 1 && error.response?.status === 502) {
          console.warn(
            `Fetching wallet details failed (502), retrying in ${
              delay / 1000
            }s...`
          );
          await new Promise((resolve) => setTimeout(resolve, delay));
          continue;
        }
        throw new Error(`Fetching wallet details failed: ${error.message}`);
      }
    }
  }

  async updateWalletStatus(wallet, retries = 100, delay = 5000) {
    for (let attempt = 0; attempt < retries; attempt++) {
      try {
        const isRunning = await this.checkNodeStatus(wallet);
        if (!isRunning) throw new Error("Node not running");

        const walletDetails = await this.checkWalletDetails(wallet);
        return walletDetails;
      } catch (error) {
        if (
          attempt < retries - 1 &&
          (error.response?.status === 502 || error.code === "ETIMEDOUT")
        ) {
          console.warn(
            `[Retry ${
              attempt + 1
            }] Updating wallet status failed, retrying in ${delay / 1000}s...`
          );
          await new Promise((resolve) => setTimeout(resolve, delay));
        } else {
          throw new Error(`Update wallet status failed: ${error.message}`);
        }
      }
    }
  }

  async claimDailyPoints(wallet, privateKey, retries = 100, delay = 5000) {
    for (let attempt = 0; attempt < retries; attempt++) {
      try {
        const walletInstance = new Wallet(privateKey);
        const timestamp = Date.now();
        const message = `I am claiming my daily node point for ${wallet} at ${timestamp}`;
        const sign = await walletInstance.signMessage(message);

        const response = await this.getApi().post(
          `/light-node/claim-node-points`,
          {
            walletAddress: wallet,
            timestamp: timestamp,
            sign: sign,
          }
        );

        return response.data?.message === "node points claimed successfully";
      } catch (error) {
        if (error.response?.status === 405) {
          throw new Error("Points already claimed today");
        }

        if (
          attempt < retries - 1 &&
          (error.response?.status === 502 || error.code === "ETIMEDOUT")
        ) {
          console.warn(
            `[Retry ${attempt + 1}] Claiming daily points failed, retrying in ${
              delay / 1000
            }s...`
          );
          await new Promise((resolve) => setTimeout(resolve, delay));
        } else {
          throw new Error(`Claim points failed: ${error.message}`);
        }
      }
    }
  }

  async signAndStart(wallet, privateKey, retries = 100, delay = 5000) {
    for (let attempt = 0; attempt < retries; attempt++) {
      try {
        const walletInstance = new Wallet(privateKey);
        const timestamp = Date.now();
        const message = `Node activation request for ${wallet} at ${timestamp}`;
        const sign = await walletInstance.signMessage(message);

        const response = await this.getApi().post(
          `/light-node/node-action/${wallet}/start`,
          {
            sign: sign,
            timestamp: timestamp,
          }
        );

        return response.data?.message === "node action executed successfully";
      } catch (error) {
        if (
          attempt < retries - 1 &&
          (error.response?.status === 502 || error.code === "ETIMEDOUT")
        ) {
          console.warn(
            `[Retry ${attempt + 1}] Node activation failed, retrying in ${
              delay / 1000
            }s...`
          );
          await new Promise((resolve) => setTimeout(resolve, delay));
        } else {
          throw new Error(`Node activation failed: ${error.message}`);
        }
      }
    }
  }

  async startPing(wallet) {
    if (this.pingIntervals.has(wallet)) {
      return;
    }

    const stats = this.walletStats.get(wallet);

    try {
      const privateKey = this.privateKeys.get(wallet);

      if (!privateKey) {
        throw new Error("Private key not found for wallet");
      }

      stats.status = "Checking Status";
      this.renderDashboard();

      let isRunning = await this.checkNodeStatus(wallet);
      if (!isRunning) {
        stats.status = "Activating";
        this.renderDashboard();

        await this.signAndStart(wallet, privateKey);
        stats.status = "Activated";
        this.renderDashboard();

        for (let attempt = 0; attempt < 100; attempt++) {
          await new Promise((resolve) => setTimeout(resolve, 5000)); // ⏳ Tunggu sebelum retry
          isRunning = await this.checkNodeStatus(wallet);
          if (isRunning) break;
          console.warn(`[Retry ${attempt + 1}] Checking node status...`);
        }

        if (!isRunning) {
          throw new Error("Node activation failed after multiple attempts");
        }
      }

      await new Promise((resolve) => setTimeout(resolve, 5000));

      const { nodePoints, dailyStreak, lastClaimed } =
        await this.updateWalletStatus(wallet);
      
      const lastClaimedUTC = new Date(lastClaimed).getTime();
      if (!lastClaimed || Date.now() - lastClaimedUTC >= 24 * 60 * 60 * 1000) {
        try {
          const claimed = await this.claimDailyPoints(wallet, privateKey);
          if (claimed) {
            stats.status = "Daily Rewards Claimed Succesfully!";
            this.renderDashboard();

            const { nodePoints, dailyStreak, lastClaimed } =
              await this.updateWalletStatus(wallet);
            stats.points = nodePoints;
            stats.dailyStreak = dailyStreak;
            stats.lastClaimed = lastClaimed
              ? new Intl.DateTimeFormat("en-US", {
                  month: "short",
                  day: "numeric",
                  hour: "numeric",
                  minute: "numeric",
                  second: "numeric",
                  hour12: true,
                }).format(new Date(lastClaimed)).toLocaleString()
              : "Never Claimed";
          }
        } catch (error) {
          console.error(
            `Error claiming daily points for ${wallet}:`,
            error.message
          );
          stats.error = error.message;
        }
      }

      stats.lastPing = new Date().toLocaleTimeString();
      stats.points = nodePoints || stats.points;
      stats.dailyStreak = dailyStreak;
      stats.lastClaimed = lastClaimed
        ? new Intl.DateTimeFormat("en-US", {
            month: "short",
            day: "numeric",
            hour: "numeric",
            minute: "numeric",
            second: "numeric",
            hour12: true,
          }).format(new Date(lastClaimed)).toLocaleString()
        : "Never Claimed";
      stats.status = "Active";
      stats.error = null;
    } catch (error) {
      stats.status = "Error";
      stats.error = error.message;
      console.error(`Error starting node for ${wallet}:`, error.message);
      return;
    }

    const pingInterval = setInterval(async () => {
      try {
        const { nodePoints, dailyStreak, lastClaimed } =
          await this.updateWalletStatus(wallet);
        stats.lastPing = new Date().toLocaleTimeString();
        stats.points = nodePoints || stats.points;
        stats.dailyStreak = dailyStreak;
        stats.lastClaimed = lastClaimed
          ? new Intl.DateTimeFormat("en-US", {
              month: "short",
              day: "numeric",
              hour: "numeric",
              minute: "numeric",
              second: "numeric",
              hour12: true,
            }).format(new Date(lastClaimed)).toLocaleString()
          : "Never Claimed";
        stats.status = "Active";
        stats.error = null;
        
      const lastClaimedUTC = new Date(lastClaimed).getTime();
      if (!lastClaimed || Date.now() - lastClaimedUTC >= 24 * 60 * 60 * 1000) {
          try {
            const claimed = await this.claimDailyPoints(wallet, privateKey);
            if (claimed) {
              stats.status = "Claimed Daily Points";
              this.renderDashboard();

              const { nodePoints, dailyStreak, lastClaimed } =
                await this.updateWalletStatus(wallet);
              stats.points = nodePoints;
              stats.dailyStreak = dailyStreak;
              stats.lastClaimed = lastClaimed
                ? new Intl.DateTimeFormat("en-US", {
                    month: "short",
                    day: "numeric",
                    hour: "numeric",
                    minute: "numeric",
                    second: "numeric",
                    hour12: true,
                  }).format(new Date(lastClaimed)).toLocaleString()
                : "Never Claimed";
            }
          } catch (error) {
            console.error(
              `Error claiming daily points for ${wallet}:`,
              error.message
            );
            stats.error = error.message;
          }
        }
      } catch (error) {
        stats.status = "Error";
        stats.error = error.message;
      }
      this.renderDashboard();
    }, CONFIG.PING_INTERVAL_MS);

    this.pingIntervals.set(wallet, pingInterval);
    this.renderDashboard();
  }

  renderDashboard() {
    const now = Date.now();
    if (now - this.lastRender < this.minRenderInterval) {
      if (this.renderTimeout) {
        clearTimeout(this.renderTimeout);
      }
      this.renderTimeout = setTimeout(() => {
        this.actualRender();
      }, this.minRenderInterval);
      return;
    }

    this.actualRender();
  }

  actualRender() {
    this.lastRender = Date.now();
    let output = [];

    output.push("\x1b[2J\x1b[H");

    output.push(getBanner());

    const startIndex = this.currentPage * this.walletsPerPage;
    const endIndex = Math.min(
      startIndex + this.walletsPerPage,
      this.wallets.length
    );
    const totalPages = Math.ceil(this.wallets.length / this.walletsPerPage);

    for (let i = startIndex; i < endIndex; i++) {
      const wallet = this.wallets[i];
      const stats = this.walletStats.get(wallet);
      const prefix =
        i === this.selectedIndex ? `${colors.cyan} →${colors.reset} ` : "  ";
      const shortWallet = `${wallet.substr(0, 6)}...${wallet.substr(-4)}`;

      output.push(
        `${prefix}Wallet: ${colors.accountName}${shortWallet}${colors.reset}`
      );
      output.push(
        `   Status: ${this.getStatusColor(stats.status)}${stats.status}${
          colors.reset
        }`
      );
      output.push(`   Points: ${colors.info}${stats.points}${colors.reset}`);
      output.push(
        `   Streak: ${colors.info}${stats.dailyStreak}${colors.reset}`
      );
      output.push(
        `   Last Ping: ${colors.info}${stats.lastPing}${colors.reset}`
      );
      output.push(
        `   Last Claim: ${colors.info}${stats.lastClaimed}${colors.reset}`
      );
      if (stats.error) {
        output.push(`   Error: ${colors.error}${stats.error}${colors.reset}`);
      }
      output.push("");
    }

    output.push(
      `\n${colors.menuBorder}Page ${this.currentPage + 1}/${totalPages}${
        colors.reset
      }`
    );
    output.push(`\n${colors.menuTitle}Configuration:${colors.reset}`);
    output.push(
      `${colors.menuOption}Ping Interval: ${CONFIG.PING_INTERVAL} minute(s)${colors.reset}`
    );
    output.push(`\n${colors.menuTitle}Controls:${colors.reset}`);
    output.push(
      `${colors.menuOption}↑/↓: Navigate | ←/→: Change Page | Ctrl+C: Exit${colors.reset}\n`
    );

    process.stdout.write(output.join("\n"));
  }

  getStatusColor(status) {
    switch (status) {
      case "Active":
        return colors.success;
      case "Error":
        return colors.error;
      case "Activated":
        return colors.taskComplete;
      case "Activation Failed":
        return colors.taskFailed;
      case "Starting":
        return colors.taskInProgress;
      case "Checking Status":
        return colors.taskInProgress;
      case "Activating":
        return colors.taskInProgress;
      default:
        return colors.reset;
    }
  }

  handleKeyPress(str, key) {
    const startIndex = this.currentPage * this.walletsPerPage;
    const endIndex = Math.min(
      startIndex + this.walletsPerPage,
      this.wallets.length
    );
    const totalPages = Math.ceil(this.wallets.length / this.walletsPerPage);

    if (key.name === "up" && this.selectedIndex > startIndex) {
      this.selectedIndex--;
      this.renderDashboard();
    } else if (key.name === "down" && this.selectedIndex < endIndex - 1) {
      this.selectedIndex++;
      this.renderDashboard();
    } else if (key.name === "left" && this.currentPage > 0) {
      this.currentPage--;
      this.selectedIndex = this.currentPage * this.walletsPerPage;
      this.renderDashboard();
    } else if (key.name === "right" && this.currentPage < totalPages - 1) {
      this.currentPage++;
      this.selectedIndex = this.currentPage * this.walletsPerPage;
      this.renderDashboard();
    }
  }

  async start() {
    process.on("SIGINT", function () {
      console.log(`\n${colors.info}Shutting down...${colors.reset}`);
      process.exit();
    });

    process.on("exit", () => {
      for (let [wallet, interval] of this.pingIntervals) {
        clearInterval(interval);
      }
      process.stdin.setRawMode(false);
      process.stdin.pause();
    });

    await this.initialize();
    this.renderDashboard();

    process.stdin.on("keypress", (str, key) => {
      if (key.ctrl && key.name === "c") {
        process.emit("SIGINT");
      } else {
        this.handleKeyPress(str, key);
      }
    });
  }
}

const dashboard = new WalletDashboard();
dashboard.start().catch((error) => {
  console.error(`${colors.error}Fatal error: ${error}${colors.reset}`);
  process.exit(1);
});
