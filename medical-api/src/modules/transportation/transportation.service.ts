import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AlertsService } from '../alerts/alerts.service';

@Injectable()
export class TransportationService {
  private readonly logger = new Logger(TransportationService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly alerts: AlertsService,
  ) {}

  async book(userId: string, data: {
    appointmentId?: string;
    vehicleType?: string;
    pickupAddress: string;
    pickupLat?: number;
    pickupLng?: number;
    destAddress: string;
    destLat?: number;
    destLng?: number;
    scheduledAt: string;
    notes?: string;
  }) {
    // Simple distance estimation (Haversine approximation)
    let distanceKm: number | null = null;
    let estimatedMins: number | null = null;
    if (data.pickupLat && data.pickupLng && data.destLat && data.destLng) {
      distanceKm = this.haversine(data.pickupLat, data.pickupLng, data.destLat, data.destLng);
      estimatedMins = Math.round((distanceKm / 40) * 60); // ~40km/h average
    }

    const booking = await this.prisma.transportationBooking.create({
      data: {
        userId,
        appointmentId: data.appointmentId,
        vehicleType: (data.vehicleType as any) || 'STANDARD',
        pickupAddress: data.pickupAddress,
        pickupLat: data.pickupLat,
        pickupLng: data.pickupLng,
        destAddress: data.destAddress,
        destLat: data.destLat,
        destLng: data.destLng,
        distanceKm,
        estimatedMins,
        scheduledAt: new Date(data.scheduledAt),
        notes: data.notes,
      },
    });

    const admins = await this.prisma.user.findMany({
      where: { role: 'ADMIN' },
      select: { id: true },
    });

    await Promise.all(
      admins.map((admin) =>
        this.alerts.createAlert({
          userId: admin.id,
          type: 'TRANSPORT_DISPATCH',
          severity: 'INFO',
          title: 'New transport booking needs dispatch',
          message: `Transport booking ${booking.id} from ${data.pickupAddress} to ${data.destAddress} is ready for dispatch.`,
          data: {
            bookingId: booking.id,
            userId,
            pickupLat: data.pickupLat,
            pickupLng: data.pickupLng,
            destLat: data.destLat,
            destLng: data.destLng,
            vehicleType: data.vehicleType,
            scheduledAt: data.scheduledAt,
          },
          channels: ['in_app'],
        }),
      ),
    );

    return booking;
  }

  async getUserBookings(userId: string) {
    return this.prisma.transportationBooking.findMany({
      where: { userId },
      orderBy: { scheduledAt: 'desc' },
      include: { appointment: true },
    });
  }

  async cancel(id: string) {
    return this.prisma.transportationBooking.update({
      where: { id },
      data: { status: 'CANCELLED' },
    });
  }

  async updateStatus(id: string, status: string) {
    return this.prisma.transportationBooking.update({
      where: { id },
      data: { status: status as any },
    });
  }

  private haversine(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371;
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLon = ((lon2 - lon1) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }
}
