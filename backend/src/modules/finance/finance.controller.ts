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
import { Roles } from '../../common/decorators/roles.decorator';
import type { AuthenticatedUser } from '../../common/types/auth-request';
import { Role } from '../../generated/prisma/client';
import { QueryChargesDto } from './dto/query-charges.dto';
import { QueryFinanceSummaryDto } from './dto/query-finance-summary.dto';
import { RegisterPaymentDto } from './dto/register-payment.dto';
import { VoidPaymentDto } from './dto/void-payment.dto';
import { FinanceService } from './finance.service';

/**
 * Sem @Roles de classe: qualquer papel autenticado pode ver o Financeiro
 * (resumo/cobranças) — mesmo padrão de leitura já usado em treatment-cycles.
 * Registrar/reverter pagamento é ADMIN/RECEPTION/NUTRITIONIST, igual à
 * correção de valores da contratação (Missão 0005.8, ajuste final).
 */
@ApiTags('finance')
@ApiBearerAuth()
@Controller('finance')
export class FinanceController {
  constructor(private readonly financeService: FinanceService) {}

  @Get('summary')
  getSummary(
    @CurrentTenant() tenantId: string,
    @Query() query: QueryFinanceSummaryDto,
  ) {
    return this.financeService.getSummary(tenantId, query);
  }

  @Get('charges')
  listCharges(
    @CurrentTenant() tenantId: string,
    @Query() query: QueryChargesDto,
  ) {
    return this.financeService.listCharges(tenantId, query);
  }

  @Get('charges/:id')
  getChargeById(
    @CurrentTenant() tenantId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.financeService.getChargeById(tenantId, id);
  }

  @Post('payments')
  @Roles(Role.ADMIN, Role.RECEPTION, Role.NUTRITIONIST)
  registerPayment(
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: RegisterPaymentDto,
  ) {
    return this.financeService.registerPayment(tenantId, user.userId, dto);
  }

  @Patch('payments/:id/void')
  @Roles(Role.ADMIN, Role.RECEPTION, Role.NUTRITIONIST)
  async voidPayment(
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: VoidPaymentDto,
  ) {
    await this.financeService.voidPayment(
      tenantId,
      user.userId,
      id,
      dto.reason,
    );
    return { status: 'voided' };
  }
}
