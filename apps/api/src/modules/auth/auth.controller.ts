import { Body, Controller, Get, Param, Patch, Post, UsePipes } from '@nestjs/common';
import { Role } from '@prisma/client';
import { Public } from '../../common/decorators/public.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { AuthService } from './auth.service';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import {
  LoginRequestSchema,
  LoginRequest,
  RegisterRequestSchema,
  RegisterRequest,
  RefreshTokenRequestSchema,
  RefreshTokenRequest,
  ResetPasswordRequestSchema,
  ResetPasswordRequest,
  CompletePasswordResetRequestSchema,
  CompletePasswordResetRequest,
  VerifyEmailRequestSchema,
  VerifyEmailRequest,
  ResolveTeamJoinRequestDto,
  ResolveTeamJoinRequestSchema,
} from '@shift-complete/shared-types';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Post('login')
  @UsePipes(new ZodValidationPipe(LoginRequestSchema))
  login(@Body() body: LoginRequest) {
    return this.authService.login(body.email, body.password);
  }

  @Public()
  @Post('register')
  @UsePipes(new ZodValidationPipe(RegisterRequestSchema))
  register(@Body() body: RegisterRequest) {
    return this.authService.register(body);
  }

  @Public()
  @Get('registration-teams')
  registrationTeams() {
    return this.authService.listRegistrationTeams();
  }

  @Roles(Role.administrator, Role.service_leader)
  @Patch('signup-requests/:requestId')
  @UsePipes(new ZodValidationPipe(ResolveTeamJoinRequestSchema))
  resolveSignupRequest(
    @Param('requestId') requestId: string,
    @Body() body: ResolveTeamJoinRequestDto,
    @CurrentUser() user: { sub: string; role: Role }
  ) {
    if (body.status === 'APPROVED') {
      return this.authService.approveSignupRequest(requestId, user.sub, user.role);
    }

    return this.authService.declineSignupRequest(requestId, user.sub, user.role);
  }

  @Public()
  @Post('refresh')
  @UsePipes(new ZodValidationPipe(RefreshTokenRequestSchema))
  refresh(@Body() body: RefreshTokenRequest) {
    return this.authService.refresh(body.refreshToken);
  }

  @Public()
  @Post('password-reset/request')
  @UsePipes(new ZodValidationPipe(ResetPasswordRequestSchema))
  requestPasswordReset(@Body() body: ResetPasswordRequest) {
    return this.authService.requestPasswordReset(body.email);
  }

  @Public()
  @Post('password-reset/complete')
  @UsePipes(new ZodValidationPipe(CompletePasswordResetRequestSchema))
  completePasswordReset(@Body() body: CompletePasswordResetRequest) {
    return this.authService.resetPassword(body.token, body.password);
  }

  @Public()
  @Post('verify-email')
  @UsePipes(new ZodValidationPipe(VerifyEmailRequestSchema))
  verifyEmail(@Body() body: VerifyEmailRequest) {
    return this.authService.verifyEmail(body.token);
  }

  @Public()
  @Post('verify-email/resend')
  @UsePipes(new ZodValidationPipe(ResetPasswordRequestSchema))
  resendVerification(@Body() body: ResetPasswordRequest) {
    return this.authService.resendVerification(body.email);
  }
}
