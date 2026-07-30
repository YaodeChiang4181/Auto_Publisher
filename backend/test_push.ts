import { prisma } from './src/prisma';
import * as line from '@line/bot-sdk';

async function main() {
  const lineClient = new line.messagingApi.MessagingApiClient({
    channelAccessToken: (process as any).env.LINE_CHANNEL_ACCESS_TOKEN || ''
  });

  console.log('Fetching latest session with lineUserId...');
  const session = await (prisma.session as any).findFirst({
    where: {
      lineUserId: {
        not: null
      }
    },
    orderBy: {
      verifiedAt: 'desc'
    }
  });

  // @ts-ignore
  if (!session || !session.lineUserId) {
    console.log('No session with lineUserId found.');
    return;
  }

  // @ts-ignore
  console.log(`Found lineUserId: ${session.lineUserId}. Attempting push...`);

  try {
    const res = await lineClient.pushMessage({
      // @ts-ignore
      to: session.lineUserId,
      messages: [{
        type: 'text',
        text: '這是一條測試推播訊息！如果您收到這則訊息，代表 LINE 推播功能完全正常！'
      }]
    });
    console.log('Push message sent successfully!', res);
  } catch (error: any) {
    console.error('Failed to send push message:');
    if (error.response) {
      console.error(error.response.data);
    } else {
      console.error(error.message);
    }
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
