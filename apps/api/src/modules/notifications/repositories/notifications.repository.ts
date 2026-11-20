import { Injectable } from '@nestjs/common';

import { DatabaseService } from '../../../infrastructure/database/database.service';
import type { ListNotificationsQueryDto } from '../dto/list-notifications-query.dto';

/**
 * Tenant-scoped data access for 'notifications'. Always resolve via
 * `this.db.forTenant(organisationId)` — every method here ALSO filters by
 * `userId`, since a notification belongs to one user, not the whole org.
 */
@Injectable()
export class NotificationsRepository {
  constructor(private readonly db: DatabaseService) {}

  async findMany(organisationId: string, userId: string, query: ListNotificationsQueryDto) {
    const db = this.db.forTenant(organisationId);
    const where = { userId, ...(query.unreadOnly ? { readAt: null } : {}) };

    const [items, totalItems] = await Promise.all([
      db.notification.findMany({
        where,
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
        orderBy: { createdAt: 'desc' },
      }),
      db.notification.count({ where }),
    ]);

    return { items, totalItems };
  }

  countUnread(organisationId: string, userId: string) {
    return this.db.forTenant(organisationId).notification.count({ where: { userId, readAt: null } });
  }

  findById(organisationId: string, userId: string, id: string) {
    return this.db.forTenant(organisationId).notification.findFirst({ where: { id, userId } });
  }

  /**
   * The notifications of `fromUserId` that lead to one of these records (their link is the record's path, with or without a
   * query or a #section) go to `toUserId`; each person in `alsoUserIds` gets a copy. Read marks and dates are kept. Returns how many moved.
   */
  async handOver(organisationId: string, fromUserId: string, toUserId: string, alsoUserIds: string[], paths: string[]): Promise<number> {
    if (paths.length === 0) return 0;
    const db = this.db.forTenant(organisationId);
    const rows = await db.notification.findMany({
      where: { userId: fromUserId, OR: paths.flatMap((path) => [{ link: path }, { link: { startsWith: `${path}?` } }, { link: { startsWith: `${path}#` } }, { link: { startsWith: `${path}/` } }]) },
    });
    if (rows.length === 0) return 0;
    await db.notification.updateMany({ where: { id: { in: rows.map((row) => row.id) } }, data: { userId: toUserId } });
    for (const copyFor of alsoUserIds.filter((id) => id !== toUserId && id !== fromUserId)) {
      await db.notification.createMany({
        data: rows.map(({ type, title, message, link, readAt, createdAt }) => ({ organisationId, userId: copyFor, type, title, message, link, readAt, createdAt })),
      });
    }
    return rows.length;
  }

  create(
    organisationId: string,
    userId: string,
    data: { type: string; title: string; message?: string; link?: string },
  ) {
    return this.db.forTenant(organisationId).notification.create({
      data: { organisationId, userId, ...data },
    });
  }

  async findUserEmail(organisationId: string, userId: string): Promise<string | null> {
    const user = await this.db.forTenant(organisationId).user.findFirst({ where: { id: userId }, select: { email: true } });
    return user?.email ?? null;
  }

  markRead(organisationId: string, id: string) {
    return this.db.forTenant(organisationId).notification.update({
      where: { id },
      data: { readAt: new Date() },
    });
  }

  markAllRead(organisationId: string, userId: string) {
    return this.db.forTenant(organisationId).notification.updateMany({
      where: { userId, readAt: null },
      data: { readAt: new Date() },
    });
  }

  delete(organisationId: string, id: string) {
    return this.db.forTenant(organisationId).notification.delete({ where: { id } });
  }
}
