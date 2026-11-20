import { CurrentTenant, CurrentUser, Permissions } from '@crm/auth';
import type { TokenPayload } from '@crm/auth';
import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';

import { PERMISSIONS } from '../../../common/constants/permissions.constants';
import { JobTitleDto, UpdateOrganisationDto } from '../dto';
import { OrganisationsService } from '../service/organisations.service';

/** The signed-in user's own organisation — there is no route that names another one. */
@ApiTags('organisations')
@ApiBearerAuth()
@Controller('organisations')
export class OrganisationsController {
  constructor(private readonly organisationsService: OrganisationsService) {}

  /** Name and pay defaults: everyone reads them (the pay calculation starts from them). */
  @Get('current')
  current(@CurrentTenant() organisationId: string) {
    return this.organisationsService.current(organisationId);
  }

  @Patch('current')
  @Permissions(PERMISSIONS.USERS.MANAGE)
  update(@CurrentTenant() organisationId: string, @CurrentUser() user: TokenPayload, @Body() dto: UpdateOrganisationDto) {
    return this.organisationsService.update(organisationId, user.sub, dto);
  }

  @Get('current/integrations')
  @Permissions(PERMISSIONS.USERS.MANAGE)
  integrations() {
    return this.organisationsService.integrations();
  }

  /** The list a job's title is chosen from: everyone who works with jobs reads it, and adds, renames and removes titles. */
  @Get('current/job-titles')
  jobTitles(@CurrentTenant() organisationId: string) {
    return this.organisationsService.jobTitles(organisationId);
  }

  @Post('current/job-titles')
  @Permissions(PERMISSIONS.JOB.CREATE)
  addJobTitle(@CurrentTenant() organisationId: string, @Body() dto: JobTitleDto) {
    return this.organisationsService.addJobTitle(organisationId, dto.name);
  }

  @Patch('current/job-titles/:id')
  @Permissions(PERMISSIONS.JOB.CREATE)
  renameJobTitle(@CurrentTenant() organisationId: string, @Param('id') id: string, @Body() dto: JobTitleDto) {
    return this.organisationsService.renameJobTitle(organisationId, id, dto.name);
  }

  @Delete('current/job-titles/:id')
  @Permissions(PERMISSIONS.JOB.CREATE)
  removeJobTitle(@CurrentTenant() organisationId: string, @Param('id') id: string) {
    return this.organisationsService.removeJobTitle(organisationId, id);
  }
}
