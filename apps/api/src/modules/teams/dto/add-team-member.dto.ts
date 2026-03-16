import { IsString } from 'class-validator';

export class AddTeamMemberDto {
  @IsString()
  userId!: string;
}
