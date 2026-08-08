import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  Res,
  UnauthorizedException,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { CookieOptions, Request, Response } from 'express';
import { Public } from '../../common/decorators/public.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../../common/types/auth-request';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';

const REFRESH_COOKIE_NAME = 'refresh_token';
const ALLOWED_SAME_SITE = ['lax', 'strict', 'none'] as const;

function resolveSameSite(): CookieOptions['sameSite'] {
  const value = process.env.COOKIE_SAME_SITE;
  return (ALLOWED_SAME_SITE as readonly string[]).includes(value ?? '')
    ? (value as (typeof ALLOWED_SAME_SITE)[number])
    : 'lax';
}

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(
    @Body() dto: LoginDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.authService.login(dto.email, dto.password, {
      ip: req.ip,
      userAgent: req.headers['user-agent'],
    });

    this.setRefreshCookie(
      res,
      result.refreshToken,
      result.refreshTokenExpiresAt,
    );

    return { accessToken: result.accessToken, user: result.user };
  }

  @Public()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  async refresh(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const cookie = req.cookies?.[REFRESH_COOKIE_NAME] as string | undefined;
    if (!cookie) {
      throw new UnauthorizedException('Sessão não encontrada');
    }

    const result = await this.authService.refresh(cookie, {
      ip: req.ip,
      userAgent: req.headers['user-agent'],
    });

    this.setRefreshCookie(
      res,
      result.refreshToken,
      result.refreshTokenExpiresAt,
    );

    return { accessToken: result.accessToken, user: result.user };
  }

  @Public()
  @Post('logout')
  @HttpCode(HttpStatus.OK)
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const cookie = req.cookies?.[REFRESH_COOKIE_NAME] as string | undefined;
    await this.authService.logout(cookie);
    res.clearCookie(REFRESH_COOKIE_NAME, { path: '/' });
    return { success: true };
  }

  @Get('me')
  async me(@CurrentUser() user: AuthenticatedUser) {
    return this.authService.me(user.userId);
  }

  private setRefreshCookie(res: Response, token: string, expiresAt: Date) {
    res.cookie(REFRESH_COOKIE_NAME, token, {
      httpOnly: true,
      secure: process.env.COOKIE_SECURE === 'true',
      sameSite: resolveSameSite(),
      expires: expiresAt,
      // '/', não '/auth': em produção o Cloud Functions expõe as rotas sob
      // /api/auth/... (prefixo do nome da function), então um Path=/auth
      // nunca bate com a URL real vista pelo navegador e o cookie nunca é
      // reenviado. Localmente (sem esse prefixo) '/' também funciona.
      path: '/',
    });
  }
}
