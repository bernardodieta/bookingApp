import { Body, Controller, Get, Post, Req, UseGuards } from '@nestjs/common';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { GoogleLoginDto } from './dto/google-login.dto';
import { AuthGuard } from '../common/guards/auth.guard';
import { Request } from 'express';
import { AuthUser } from '../common/types/auth-user.type';

type RequestWithUser = Request & { user: AuthUser };

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  register(@Body() body: RegisterDto) {
    return this.authService.register(body);
  }

  @Post('login')
  login(@Body() body: LoginDto) {
    return this.authService.login(body);
  }

  @Post('google')
  loginWithGoogle(@Body() body: GoogleLoginDto) {
    return this.authService.loginWithGoogle(body);
  }

  @Get('me')
  @UseGuards(AuthGuard)
  me(@Req() req: RequestWithUser) {
    return req.user;
  }
}
