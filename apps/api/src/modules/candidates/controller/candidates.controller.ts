import { CurrentTenant, CurrentUser, Permissions } from '@crm/auth';
import type { TokenPayload } from '@crm/auth';
import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  Res,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiConsumes, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';

import { PERMISSIONS } from '../../../common/constants/permissions.constants';
import { ParseCuidPipe } from '../../../common/pipes/parse-cuid.pipe';
import { CreateCandidateDto, ExportCandidatesDto, ListCandidatesQueryDto, PreviewExportDto, SetConsentDto, UpdateCandidateDto } from '../dto';
import { CreateCandidateZoomDto } from '../dto/candidate-zoom.dto';
import { CandidateExportService } from '../service/candidate-export.service';
import { CandidateZoomService } from '../service/candidate-zoom.service';
import { CandidatesService } from '../service/candidates.service';
import { ResumeParserService } from '../service/resume-parser.service';

const MAX_RESUME_SIZE_BYTES = 10 * 1024 * 1024;

@ApiTags('candidates')
@ApiBearerAuth()
@Controller('candidates')
export class CandidatesController {
  constructor(
    private readonly candidatesService: CandidatesService,
    private readonly resumeParserService: ResumeParserService,
    private readonly candidateZoom: CandidateZoomService,
    private readonly exports: CandidateExportService,
  ) {}

  /** How many people a contact list would hold, and why the others are left out. No personal data. */
  @Post('export/preview')
  @HttpCode(HttpStatus.OK)
  @Permissions(PERMISSIONS.CANDIDATE.EXPORT)
  previewExport(@CurrentTenant() organisationId: string, @Body() dto: PreviewExportDto) {
    return this.exports.preview(organisationId, dto);
  }

  /** CSV, Excel or Dialpad contact file with only the chosen columns, and only people who may be contacted this way. */
  @Post('export')
  @HttpCode(HttpStatus.OK)
  @Permissions(PERMISSIONS.CANDIDATE.EXPORT)
  async exportCandidates(
    @CurrentTenant() organisationId: string,
    @CurrentUser() user: TokenPayload,
    @Body() dto: ExportCandidatesDto,
    @Res() res: Response,
  ) {
    const file = await this.exports.export(organisationId, user.sub, dto);
    const name = `candidates-${dto.format.toLowerCase()}-${new Date().toISOString().slice(0, 10)}${file.parts > 1 ? `-part${file.part}` : ''}.${file.extension}`;
    res.set({
      'Content-Type': file.contentType,
      'Content-Disposition': `attachment; filename="${name}"`,
      'Cache-Control': 'no-store',
      'X-Export-Rows': String(file.rows),
      'X-Export-Matching': String(file.preview.matching),
      'X-Export-Parts': String(file.parts),
      'Access-Control-Expose-Headers': 'Content-Disposition, X-Export-Rows, X-Export-Matching, X-Export-Parts',
    });
    res.send(file.buffer);
  }

  /** Admin only: records consent / opt-outs for a whole selection. */
  @Post('consent')
  @HttpCode(HttpStatus.OK)
  @Permissions(PERMISSIONS.USERS.MANAGE)
  setConsent(@CurrentTenant() organisationId: string, @CurrentUser() user: TokenPayload, @Body() dto: SetConsentDto) {
    return this.exports.setConsent(organisationId, user.sub, dto);
  }

  /** Interview stage of /candidates: creates the Zoom meeting for the candidate (no pipeline card needed). */
  @Post(':id/zoom-meeting')
  @Permissions(PERMISSIONS.CANDIDATE.UPDATE)
  createZoomMeeting(
    @CurrentTenant() organisationId: string,
    @CurrentUser() user: TokenPayload,
    @Param('id', ParseCuidPipe) id: string,
    @Body() dto: CreateCandidateZoomDto,
  ) {
    return this.candidateZoom.createMeeting(organisationId, user.sub, id, dto);
  }

  /** E-mails the candidate the date, time and link of their Zoom meeting. */
  @Post(':id/zoom-invite')
  @Permissions(PERMISSIONS.CANDIDATE.UPDATE)
  sendZoomInvite(
    @CurrentTenant() organisationId: string,
    @CurrentUser() user: TokenPayload,
    @Param('id', ParseCuidPipe) id: string,
  ) {
    return this.candidateZoom.sendInvite(organisationId, user.sub, id);
  }

  @Post('parse-resume')
  @Permissions(PERMISSIONS.CANDIDATE.CREATE)
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: MAX_RESUME_SIZE_BYTES } }))
  async parseResume(@UploadedFile() file?: Express.Multer.File) {
    if (!file) {
      throw new BadRequestException('No résumé file was uploaded.');
    }
    return this.resumeParserService.read(file);
  }

  @Get()
  @Permissions(PERMISSIONS.CANDIDATE.READ)
  list(@CurrentTenant() organisationId: string, @Query() query: ListCandidatesQueryDto) {
    return this.candidatesService.list(organisationId, query);
  }

  @Get('distance-range')
  @Permissions(PERMISSIONS.CANDIDATE.READ)
  distanceRange(@CurrentTenant() organisationId: string, @Query() query: ListCandidatesQueryDto) {
    return this.candidatesService.distanceRange(organisationId, query);
  }

  @Get(':id')
  @Permissions(PERMISSIONS.CANDIDATE.READ)
  getById(@CurrentTenant() organisationId: string, @Param('id', ParseCuidPipe) id: string) {
    return this.candidatesService.getById(organisationId, id);
  }

  @Post()
  @Permissions(PERMISSIONS.CANDIDATE.CREATE)
  create(
    @CurrentTenant() organisationId: string,
    @CurrentUser() user: TokenPayload,
    @Body() dto: CreateCandidateDto,
  ) {
    return this.candidatesService.create(organisationId, user.sub, dto);
  }

  @Patch(':id')
  @Permissions(PERMISSIONS.CANDIDATE.UPDATE)
  update(
    @CurrentTenant() organisationId: string,
    @CurrentUser() user: TokenPayload,
    @Param('id', ParseCuidPipe) id: string,
    @Body() dto: UpdateCandidateDto,
  ) {
    return this.candidatesService.update(organisationId, user.sub, id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Permissions(PERMISSIONS.CANDIDATE.DELETE)
  remove(
    @CurrentTenant() organisationId: string,
    @CurrentUser() user: TokenPayload,
    @Param('id', ParseCuidPipe) id: string,
  ) {
    return this.candidatesService.remove(organisationId, user.sub, id);
  }
}
