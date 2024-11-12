const { Client, GatewayIntentBits } = require('discord.js');
const cron = require('node-cron');
const moment = require('moment-timezone');
require('dotenv').config();
moment.locale('ko');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

let cronExp = '0 29 11 * * 1,2,3,4,5 *'

TOKEN = process.env.TOKEN;
let tutorialMessage = null;
let dailyMessage = {};
const userEntries = {};
const channelId = process.env.CHANNEL_ID;
let repeatDayNums = cronExp.split(' ')[5]
const dayTable = { '0': '일', '1': '월', '2': '화', '3': '수', '4': '목', '5': '금', '6': '토' }
let repeatDays = ''
if (repeatDayNums == '*') {
  repeatDays = '매일'
} else {
  repeatDays += '매주 '
  for (const key of Object.keys(dayTable)) {
    if (repeatDayNums.includes(key)) {
      repeatDays += dayTable[key] + ', '
    }
  }
  repeatDays = repeatDays.slice(0, -2)
}
informText = `\`${repeatDays}\` \`${cronExp.split(' ')[2].padStart(2, '0')}시 ${cronExp.split(' ')[1].padStart(2, '0')}분\`마다 새로운 스크럼이 생성됩니다.`;


// 사용가이드 추가 예정 && !help
client.on('ready', async () => {
  console.log(`Logged in as ${client.user.tag}.`);

  const channel = await client.channels.fetch(channelId);
  if (channel) {
    try {
      tutorialText = '안녕하세요, Daily Scrum Bot입니다. \n\n다음과 같이 `1.` `2.` `3.` 을 입력하고 줄바꿈(`shift + enter`)을 수행하여 내용을 입력할 수 있습니다.  \n\n예시 ) \n```\n// 1. 어제 했던 일들을 간략하게 적어주세요. \n1.\n어제 했던 일A \n어제 했던 일B \n어제 했던 일C\n// 2. 오늘의 목표를 적어주세요.\n2.\n오늘 할일A\n오늘 할일B\n오늘 할일C\n// 3. 오늘의 컨디션을 10점 이내의 정수로 표현해주세요.\n3.\n5```\n- `!delete` 또는 `!del` 명령어를 통하여 오늘 작성한 내용을 삭제 가능합니다.\n예시) `!del`,  `!del 1.`,  `!del 1`,  `!del 2`,  `!del 3`\n';

      tutorialText += '- ' + informText;
      tutorialMessage = await channel.send(tutorialText);
      console.log('Message sent:', tutorialMessage.id);

      cron.schedule(cronExp, async () => {
        const date = moment().tz('Asia/Seoul').format('YYYY-MM-DD');
        const dayOfWeek = moment(date).tz('Asia/Seoul').format('dd');
        dailyMessage[date] = await channel.send(`## ~~                            ~~**${date} (${dayOfWeek})**~~                            ~~\n가장 먼저 오늘의 스크럼을 작성해보세요!\n${informText}`);

      });

    } catch (error) {
      console.error('Failed to send the message:', error);
    }
  }
});

client.on('messageCreate', async (message) => {
  if (message.author.bot) return;

  if (message.channel.id !== channelId) return;

  const userId = message.author.id;
  const userTag = message.author.username;
  const content = message.content;
  const date = moment().tz('Asia/Seoul').format('YYYY-MM-DD');
  const dayOfWeek = moment(date).tz('Asia/Seoul').format('dd');
  const member = await message.guild.members.fetch(userId);

  const nickname = member.nickname || userTag;
  if (!dailyMessage[date]) {
    await message.delete();
    message.channel.send(`아직 스크럼이 시작되지 않았어요. (${member})\n` + informText);
    return;
  }

  if (message.content.startsWith('!update')) {
    message.channel.send('update는 현재 미구현 기능입니다');
  } else if (message.content.startsWith('!delete') || message.content.startsWith('!del')) {
    if (userEntries[date] && userEntries[date][userId]) {
      trimmed = message.content.trim()
      if (trimmed == '!delete' || trimmed == '!delete *' || trimmed == '!del' || trimmed == '!del *') {
        userEntries[date][userId] = { userTag, yesterday: '  - -\n', today: '  - -\n', condition: '? / 10' }
      }
      if (message.content.includes('1')) {
        userEntries[date][userId].yesterday = '  - -\n'
      }
      if (message.content.includes('2')) {
        userEntries[date][userId].today = '  - -\n'
      }
      if (message.content.includes('3')) {
        userEntries[date][userId].condition = '? / 10'
      }
    }
  }

  parseUserInput(userId, nickname, date, content);
  await message.delete();

  if (Object.keys(userEntries[date]).length > 0) {
    try {
      const newContent = formatDailyMessage(date);
      await dailyMessage[date].edit(`## ~~                            ~~**${date} (${dayOfWeek})**~~                            ~~\n${newContent}`);
      console.log(`${date} : ${userTag}'s Daily message updated`);
    } catch (error) {
      console.error(`${date} : ${userTag}' Failed to edit the message:`, error);
    }
  } else {
    console.log('dailyMessage is not defined yet.');
  }
});

function parseUserInput(userId, userTag, date, content) {
  if (!userEntries[date]) userEntries[date] = {};

  const userData = userEntries[date][userId] || { userTag, yesterday: '  - -\n', today: '  - -\n', condition: '? / 10' };

  const lines = content.split('\n');
  const table = { '1.': 'yesterday', '2.': 'today', '3.': 'condition' }
  let target = '';

  for (const line of lines) {
    const text = line.trim();
    if (text in table) {
      target = table[text];
      continue;
    }

    if (!target) continue;

    if (target === 'yesterday' || target === 'today') {
      userData[target] = userData[target] === '  - -' ? `  - ${text}\n` : userData[target].concat(`  - ${text}\n`);
    } else if (target === 'condition') {
      const intText = parseInt(text);
      if (Number.isInteger(intText) && 0 <= intText && intText < 11) {
        userData[target] = `${intText} / 10`;
      }
    }
  }

  userEntries[date][userId] = userData;
  console.log(userEntries);
}

function formatDailyMessage(date) {
  let message = '';
  for (const userId in userEntries[date]) {
    const entry = userEntries[date][userId];
    message += '\n';
    message += `## :busts_in_silhouette: ** ${entry.userTag}**\n`;
    message += `1. 어제 했던 일 :\n${entry.yesterday}\n`;
    message += `2. 오늘 할 일 :\n${entry.today}\n`;
    message += `3. 컨디션 :\n  - ${entry.condition}\n`;
    message += '~~';

    for (let i = 0; i < 105; i++) {
      message += ' ';
    }
    message += '~~';
  }
  return message || '*오늘은 입력된 내용이 없습니다.*';
}

client.login(TOKEN);
