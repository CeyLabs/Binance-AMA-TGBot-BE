# Binance MENA AMA Telegram Bot

A comprehensive Telegram bot built with NestJS and Telegraf to manage AMAs for MENA region groups with AI-powered question analysis and multi-language support.

## 🚀 About

This bot is specifically designed to manage and automate AMA (Ask Me Anything) sessions for Binance MENA region Telegram groups. It provides complete AMA lifecycle management from session creation to winner selection and reward distribution, with sophisticated AI analysis, multi-language support (English/Arabic), and extensive automation capabilities.

## 🛠 Features

### **AMA Lifecycle Management**
- **Session Creation**: Interactive AMA setup with customizable parameters (date, time, rewards, winner count, topics, guest speakers)
- **Multi-language Support**: Full English and Arabic AMA sessions with language-specific hashtags (`#BinanceSession`, `#جلسات_بينانس`)
- **Automated Broadcasting**: Scheduled announcements at multiple intervals (3 days, 2 days, 24h, 18h, 12h, 6h, 1h before AMA)
- **Real-time Question Handling**: Automatic detection and processing of questions from public groups
- **Forum Integration**: Creates dedicated forum threads for each AMA session

### **AI-Powered Question Analysis**
- **OpenAI Integration**: GPT-4 powered question analysis with structured scoring
- **Multi-criteria Scoring**: Evaluates questions on Originality (0-10), Clarity (0-10), and Engagement (0-10)
- **Duplicate Detection**: AI-powered duplicate question identification
- **Automated Processing**: Background processing with rate limiting and retry logic

### **Winner Selection & Rewards**
- **Smart Winner Selection**: Score-based ranking system for fair winner selection
- **Winner History Tracking**: Prevents users from winning multiple times in 30 days
- **Reward Claiming**: Deep-link system for winners to claim rewards via personalized links
- **CSV Export**: Detailed participant and scoring reports
- **Winner Broadcasting**: Automated winner announcements with congratulations

### **User Management & Subscriptions**
- **Multi-language Subscriptions**: Users can subscribe to receive AMA notifications in English or Arabic
- **Role-based Access**: Super admin, admin, and regular user roles with `/grantadmin` and `/revokeadmin` commands
- **User Profile Sync**: Automatic synchronization with Telegram user data
- **Subscription Management**: Deep-link subscription system (`/start subscribe_en` or `/start subscribe_ar`)

### **Advanced Features**
- **Timezone Management**: All operations in KSA timezone with UTC conversion
- **Custom Banner Support**: Upload custom images for AMA announcements
- **Multi-group Distribution**: Broadcasts to public groups with pinned messages
- **Rate Limiting**: Sophisticated handling of Telegram API limits
- **Error Recovery**: Comprehensive error handling with retries and fallbacks

## 🛠 Tech Stack

- **Framework**: NestJS with TypeScript
- **Bot Framework**: Telegraf (Telegram Bot Framework)
- **Database**: PostgreSQL with Knex.js ORM
- **AI Integration**: OpenAI GPT-4 API
- **Scheduling**: Node-cron for automated tasks
- **Containerization**: Docker Support
- **File Processing**: CSV generation and parsing

## 📋 Prerequisites

- Node.js v22
- Docker
- Telegram Bot Token
- OpenAI API Key
- PostgreSQL Database

## 🚀 Installation

1. Clone the repository:
```bash
git clone https://github.com/CeyLabs/Binance-AMA-TGBot-BE.git
cd Binance-AMA-TGBot-BE
```

2. Create `.env` file:
```bash
cp .env.example .env
# Update .env file with your configuration including:
# - BOT_TOKEN (Telegram Bot Token)
# - OPENAI_API_KEY (OpenAI API Key)
# - DATABASE_URL (PostgreSQL connection string)
# - ADMIN_GROUP_ID (Admin group ID)
# - EN_PUBLIC_GROUP_ID (English public group ID)
# - AR_PUBLIC_GROUP_ID (Arabic public group ID)
```

3. Install dependencies:
```bash
bun install
```

4. Start the PostgreSQL database using Docker:
```bash
docker-compose up -d
```

5. Run database migrations:
```bash
bun run migrate
bun run fixtures
```

6. Start the development server:
```bash
bun run serve:local
```

## 🤖 Bot Commands

### **Admin Commands**
- `/newama <language> <sessionNo>` - Create new AMA session (interactive setup)
- `/startama <sessionNo>` - Start an AMA session
- `/endama <sessionNo>` - End an AMA session
- `/selectwinners <sessionNo>` - Select winners for completed AMA
- `/grantadmin <user_id>` - Grant admin privileges (super admin only)
- `/revokeadmin <user_id>` - Revoke admin privileges (super admin only)
- `/help` - Display help information

### **User Commands**
- `/start` - General bot start command
- `/start subscribe_en` - Subscribe to English AMA notifications
- `/start subscribe_ar` - Subscribe to Arabic AMA notifications
- `/start claim_<token>` - Claim reward (for winners only)

### **Question Participation**
- Use hashtags in public groups to participate:
  - English AMAs: `#BinanceSession` 
  - Arabic AMAs: `#جلسات_بينانس`

## 🏗 AMA Workflow

### 1. **Create AMA Session**
```bash
/newama en 1  # Create English AMA session #1
/newama ar 2  # Create Arabic AMA session #2
```
- Interactive setup with inline keyboard editing
- Configure date, time, rewards, winner count, topic, guest speaker
- Upload custom banner images
- Preview before broadcasting

### 2. **Broadcast AMA**
- Automatic scheduling at multiple intervals (3 days to 1 hour before)
- Broadcasts to language-specific public groups
- Sends notifications to subscribed users
- Pins announcements in groups

### 3. **Start AMA Session**
```bash
/startama 1  # Start session #1
```
- Creates forum threads in admin groups
- Activates question collection from public groups
- Notifies public groups that AMA is live

### 4. **Question Processing**
- Users post questions with hashtags in public groups
- AI automatically analyzes and scores questions
- Questions forwarded to admin group with scores
- Real-time duplicate detection and handling

### 5. **End AMA & Select Winners**
```bash
/endama 1           # End session #1
/selectwinners 1    # Select winners for session #1
```
- Smart winner selection based on AI scores
- Excludes recent winners (30-day cooldown)
- Interactive winner confirmation
- CSV export of all participants

### 6. **Winner Notifications & Rewards**
- Automated winner announcements
- Deep-link reward claiming system
- Integration with Binance claim forms
- Multi-language congratulations

## 📊 AI Scoring System

Questions are automatically analyzed using OpenAI GPT-4 with scoring on:
- **Originality** (0-10): Uniqueness and creativity of the question
- **Clarity** (0-10): How well-structured and understandable the question is  
- **Engagement** (0-10): Potential to generate interesting discussion

## 🌐 Multi-Language Support

- **English**: `#BinanceSession` hashtag, English public group
- **Arabic**: `#جلسات_بينانس` hashtag, Arabic public group
- Language-specific subscription system
- Localized messages and date formatting
- Separate group configurations

## Admin Management

Use `/grantadmin <tg_userid>` to promote a user to admin and `/revokeadmin <tg_userid>` to remove admin privileges. When replying to a user's message, the quoted user will also be granted or revoked without specifying an ID. These commands can only be executed by `super_admin` users.
User name and username fields are automatically kept in sync with Telegram when any command or AMA question is received.
