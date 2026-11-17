import { HttpModule } from '@nestjs/axios';
import { Module } from '@nestjs/common';

import { MailService } from './mail.service';
import { GMAIL_API_TIMEOUT_MS } from '../common/constants';

@Module({
  imports: [HttpModule.register({ timeout: GMAIL_API_TIMEOUT_MS })],
  providers: [MailService],
  exports: [MailService],
})
export class MailModule {}
