import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';
import { PrismaService } from '../../prisma/prisma.service';
import { CommunicationsGateway } from '../communications/communications.gateway';

@Injectable()
export class AlertsService {
  private readonly logger = new Logger(AlertsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly gateway: CommunicationsGateway,
  ) {}

  async createAlert(data: {
    userId: string;
    type: string;
    severity?: string;
    title: string;
    message: string;
    data?: any;
    channels?: string[];
  }) {
    const alert = await this.prisma.alert.create({
      data: {
        userId: data.userId,
        type: data.type as any,
        severity: (data.severity as any) || 'INFO',
        title: data.title,
        message: data.message,
        data: data.data || undefined,
        channel: data.channels || ['in_app'],
      },
      include: { user: { select: { email: true, name: true } } },
    });

    // Trigger external channels
    const channels = data.channels || ['in_app'];
    if (channels.includes('in_app')) {
      this.gateway.emitAlert(data.userId, alert);
    }
    if (channels.includes('email')) await this.sendEmail(alert);
    if (channels.includes('sms')) await this.sendSms(alert);
    if (channels.includes('push')) await this.sendPush(alert);

    return alert;
  }

  private async sendEmail(alert: any) {
    const apiKey = process.env.SENDGRID_API_KEY;
    const fromEmail = process.env.SENDGRID_FROM_EMAIL;

    if (!apiKey || !fromEmail) {
      this.logger.log(`[Email] Sending alert to ${alert.user.email}: ${alert.title}`);
      return;
    }

    await axios.post(
      'https://api.sendgrid.com/v3/mail/send',
      {
        personalizations: [
          {
            to: [{ email: alert.user.email }],
            subject: alert.title,
          },
        ],
        from: { email: fromEmail },
        content: [
          {
            type: 'text/plain',
            value: `${alert.title}\n\n${alert.message}`,
          },
        ],
      },
      {
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
      },
    );

    this.logger.log(`[Email] Alert sent to ${alert.user.email}: ${alert.title}`);
  }

  private async sendSms(alert: any) {
    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const authToken = process.env.TWILIO_AUTH_TOKEN;
    const fromNumber = process.env.TWILIO_FROM_NUMBER;
    const toNumber = alert.data?.phone || alert.data?.phoneNumber;

    if (!accountSid || !authToken || !fromNumber || !toNumber) {
      this.logger.log(`[SMS] Sending alert to user ${alert.userId}: ${alert.title}`);
      return;
    }

    const auth = Buffer.from(`${accountSid}:${authToken}`).toString('base64');
    const body = new URLSearchParams({
      From: fromNumber,
      To: toNumber,
      Body: `${alert.title}: ${alert.message}`,
    });

    await axios.post(`https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`, body, {
      headers: {
        Authorization: `Basic ${auth}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
    });

    this.logger.log(`[SMS] Alert sent to ${toNumber}: ${alert.title}`);
  }

  private async sendPush(alert: any) {
    const serverKey = process.env.FCM_SERVER_KEY;
    const token = alert.data?.pushToken || alert.data?.deviceToken;

    if (!serverKey || !token) {
      this.logger.log(`[Push] Sending alert to user ${alert.userId}: ${alert.title}`);
      return;
    }

    await axios.post(
      'https://fcm.googleapis.com/fcm/send',
      {
        to: token,
        notification: {
          title: alert.title,
          body: alert.message,
        },
        data: alert.data || {},
      },
      {
        headers: {
          Authorization: `key=${serverKey}`,
          'Content-Type': 'application/json',
        },
      },
    );

    this.logger.log(`[Push] Alert sent to ${alert.userId}: ${alert.title}`);
  }

  /** Trigger critical risk alert when analysis yields HIGH/CRITICAL */
  async triggerRiskAlert(userId: string, disease: string, riskLevel: string, confidence: number) {
    if (riskLevel === 'HIGH' || riskLevel === 'CRITICAL') {
      return this.createAlert({
        userId,
        type: 'CRITICAL_RISK',
        severity: riskLevel === 'CRITICAL' ? 'EMERGENCY' : 'CRITICAL',
        title: `${riskLevel} Risk Detected: ${disease}`,
        message: `AI analysis detected ${riskLevel} risk for ${disease} with ${(confidence * 100).toFixed(0)}% confidence. Please consult with your assigned specialist.`,
        data: { disease, riskLevel, confidence },
        channels: ['in_app', 'email'],
      });
    }
    return null;
  }

  async getUserAlerts(userId: string, unreadOnly = false) {
    return this.prisma.alert.findMany({
      where: {
        userId,
        ...(unreadOnly ? { read: false, dismissed: false } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
  }

  async getUnreadCount(userId: string) {
    const count = await this.prisma.alert.count({
      where: { userId, read: false, dismissed: false },
    });
    return { unreadCount: count };
  }

  async markRead(id: string) {
    return this.prisma.alert.update({ where: { id }, data: { read: true } });
  }

  async dismiss(id: string) {
    return this.prisma.alert.update({ where: { id }, data: { dismissed: true } });
  }

  async markAllRead(userId: string) {
    await this.prisma.alert.updateMany({
      where: { userId, read: false },
      data: { read: true },
    });
    return { success: true };
  }
}
