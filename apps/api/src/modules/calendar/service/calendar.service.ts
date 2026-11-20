import { totalPages } from '@crm/utils';
import { Injectable } from '@nestjs/common';

import { ResourceNotFoundException } from '../../../common/exceptions/app.exception';
import { NotificationsService } from '../../notifications/service/notifications.service';
import type { CreateCalendarEventDto } from '../dto/create-calendar-event.dto';
import type { ListCalendarEventsQueryDto } from '../dto/list-calendar-events-query.dto';
import type { UpdateCalendarEventDto } from '../dto/update-calendar-event.dto';
import { CalendarRepository } from '../repositories/calendar.repository';

import { formatEventWhen } from './calendar-time';

const EVENT_TYPE_LABEL: Record<string, string> = {
  INTERVIEW: 'Interview',
  MEETING: 'Meeting',
  CALL: 'Call',
};

@Injectable()
export class CalendarService {
  constructor(
    private readonly repository: CalendarRepository,
    private readonly notifications: NotificationsService,
  ) {}

  async list(organisationId: string, query: ListCalendarEventsQueryDto) {
    const { items, totalItems } = await this.repository.findMany(organisationId, query);
    return {
      items,
      page: query.page,
      pageSize: query.pageSize,
      totalItems,
      totalPages: totalPages(totalItems, query.pageSize),
    };
  }

  async getById(organisationId: string, id: string) {
    const event = await this.repository.findById(organisationId, id);
    if (!event) throw new ResourceNotFoundException('CalendarEvent', id);
    return event;
  }

  /** Cheap existence check (no relations loaded) for callers that ignore `getById`'s result; throws exactly what `getById` throws. */
  async assertExists(organisationId: string, id: string): Promise<void> {
    if (!(await this.repository.exists(organisationId, id))) {
      throw new ResourceNotFoundException('CalendarEvent', id);
    }
  }

  async create(organisationId: string, userId: string, dto: CreateCalendarEventDto) {
    const event = await this.repository.create(organisationId, userId, dto);

    // The owner of the event is told (a notification in the platform, with a copy to their e-mail), also when they
    // put it on their own calendar: the e-mail is their written record of the date, the time and the link.
    const label = EVENT_TYPE_LABEL[event.type] ?? 'Event';
    await this.notifications.notify(organisationId, event.userId, {
      type: `${event.type}_SCHEDULED`,
      title: `${label} scheduled: ${event.title}`,
      message: [formatEventWhen(new Date(event.startAt)), event.meetingUrl ? `Join: ${event.meetingUrl}` : null].filter(Boolean).join('\n'),
      link: `/calendar?eventId=${event.id}`,
    });

    return event;
  }

  async update(organisationId: string, id: string, dto: UpdateCalendarEventDto) {
    const before = await this.getById(organisationId, id);
    const event = await this.repository.update(organisationId, id, dto);
    // a new time: the owner is told again (and the reminder before it is sent afresh)
    if (dto.startAt && new Date(dto.startAt).getTime() !== new Date(before.startAt).getTime()) {
      await this.notifications.notify(organisationId, event.userId, {
        type: `${event.type}_RESCHEDULED`,
        title: `${EVENT_TYPE_LABEL[event.type] ?? 'Event'} moved: ${event.title}`,
        message: [formatEventWhen(new Date(event.startAt)), event.meetingUrl ? `Join: ${event.meetingUrl}` : null].filter(Boolean).join('\n'),
        link: `/calendar?eventId=${event.id}`,
      });
    }
    return event;
  }

  async remove(organisationId: string, id: string) {
    await this.assertExists(organisationId, id);
    await this.repository.delete(organisationId, id);
  }
}
