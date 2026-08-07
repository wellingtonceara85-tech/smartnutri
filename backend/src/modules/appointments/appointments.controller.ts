import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentTenant } from '../../common/decorators/current-tenant.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../../common/types/auth-request';
import { AppointmentsService } from './appointments.service';
import { CancelAppointmentDto } from './dto/cancel-appointment.dto';
import { CompleteAppointmentDto } from './dto/complete-appointment.dto';
import { ConfirmAppointmentDto } from './dto/confirm-appointment.dto';
import { CreateAppointmentDto } from './dto/create-appointment.dto';
import { NoShowAppointmentDto } from './dto/no-show-appointment.dto';
import { QueryAppointmentsDto } from './dto/query-appointments.dto';
import { RescheduleAppointmentDto } from './dto/reschedule-appointment.dto';
import { UpdateAppointmentDto } from './dto/update-appointment.dto';

/**
 * Sem @Roles de classe: ADMIN/NUTRITIONIST/RECEPTION acessam a agenda por
 * padrão (seção 37 do prompt da missão). Restrições de RECEPTION a notas
 * clínicas são aplicadas dentro do service (nível de campo, não de rota).
 */
@ApiTags('appointments')
@ApiBearerAuth()
@Controller('appointments')
export class AppointmentsController {
  constructor(private readonly appointmentsService: AppointmentsService) {}

  @Get('calendar')
  calendar(
    @CurrentTenant() tenantId: string,
    @Query() query: QueryAppointmentsDto,
  ) {
    return this.appointmentsService.list(tenantId, query);
  }

  @Get()
  list(
    @CurrentTenant() tenantId: string,
    @Query() query: QueryAppointmentsDto,
  ) {
    return this.appointmentsService.list(tenantId, query);
  }

  @Get(':id')
  getById(
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.appointmentsService.getById(tenantId, id, user.role);
  }

  @Post()
  create(
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateAppointmentDto,
  ) {
    return this.appointmentsService.create(
      tenantId,
      user.userId,
      user.role,
      dto,
    );
  }

  @Patch(':id')
  update(
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateAppointmentDto,
  ) {
    return this.appointmentsService.update(
      tenantId,
      user.userId,
      user.role,
      id,
      dto,
    );
  }

  @Post(':id/confirm')
  confirm(
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ConfirmAppointmentDto,
  ) {
    return this.appointmentsService.confirm(
      tenantId,
      user.userId,
      user.role,
      id,
      dto,
    );
  }

  @Post(':id/start')
  start(
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.appointmentsService.start(tenantId, user.userId, user.role, id);
  }

  @Post(':id/complete')
  complete(
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CompleteAppointmentDto,
  ) {
    return this.appointmentsService.complete(
      tenantId,
      user.userId,
      user.role,
      id,
      dto,
    );
  }

  @Post(':id/cancel')
  cancel(
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CancelAppointmentDto,
  ) {
    return this.appointmentsService.cancel(
      tenantId,
      user.userId,
      user.role,
      id,
      dto,
    );
  }

  @Post(':id/no-show')
  noShow(
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: NoShowAppointmentDto,
  ) {
    return this.appointmentsService.noShow(
      tenantId,
      user.userId,
      user.role,
      id,
      dto,
    );
  }

  @Post(':id/reschedule')
  reschedule(
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RescheduleAppointmentDto,
  ) {
    return this.appointmentsService.reschedule(
      tenantId,
      user.userId,
      user.role,
      id,
      dto,
    );
  }
}
