import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ArmyTester, TesterRank, TesterStatus } from '../database/entities/army-tester.entity';
import { PlayerService } from '../player/player.service';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class TesterArmyService {
  private readonly programRoles: string[];

  constructor(
    @InjectRepository(ArmyTester)
    private readonly armyTesterRepository: Repository<ArmyTester>,
    private readonly playerService: PlayerService,
    private readonly configService: ConfigService,
  ) {
    this.programRoles = this.configService.get('program.roles') || [];
  }

  async syncMembership(
    discordUserId: string,
    discordUsername: string,
    displayName: string | null,
    memberRoles: string[],
  ): Promise<ArmyTester | null> {
    // Ensure player exists
    await this.playerService.upsertUser(discordUserId, discordUsername, displayName || undefined);

    // Check if member has any program role
    const hasProgramRole = memberRoles.some((role) =>
      this.programRoles.includes(role),
    );

    const existing = await this.armyTesterRepository.findOne({
      where: { discordUserId },
    });

    if (hasProgramRole) {
      if (existing) {
        // Don't override rank - it should be determined by Gems via evaluateRank()
        // Only update membership status
        existing.status = 'active';
        existing.leftAt = null;
        existing.lastActivityAt = new Date();
        return await this.armyTesterRepository.save(existing);
      } else {
        // For new testers, start with recruit rank
        // Rank will be evaluated automatically based on Gems
        const newTester = this.armyTesterRepository.create({
          discordUserId,
          status: 'active',
          currentRank: 'recruit',
          lastActivityAt: new Date(),
        });
        return await this.armyTesterRepository.save(newTester);
      }
    } else {
      // Member doesn't have program role
      if (existing && existing.status === 'active') {
        existing.status = 'left';
        existing.leftAt = new Date();
        return await this.armyTesterRepository.save(existing);
      }
      return null;
    }
  }

  private getRankFromRoles(roles: string[]): TesterRank {
    if (roles.includes('Founders Circle')) return 'founders_circle';
    if (roles.includes('Test Pilot')) return 'test_pilot';
    if (roles.includes('Explorer')) return 'explorer';
    return 'recruit';
  }

  async getTester(discordUserId: string): Promise<ArmyTester | null> {
    return await this.armyTesterRepository.findOne({
      where: { discordUserId },
      relations: ['user'],
    });
  }

  async updateRank(
    discordUserId: string,
    newRank: TesterRank,
  ): Promise<ArmyTester> {
    const tester = await this.getTester(discordUserId);
    if (!tester) {
      throw new Error(`Tester ${discordUserId} not found`);
    }
    tester.currentRank = newRank;
    return await this.armyTesterRepository.save(tester);
  }

  async updateTcTotals(
    discordUserId: string,
    tcConfirmed: number,
    tcPending: number,
    structuredReportsConfirmed: number,
  ): Promise<ArmyTester> {
    const tester = await this.getTester(discordUserId);
    if (!tester) {
      throw new Error(`Tester ${discordUserId} not found`);
    }
    tester.tcConfirmedTotal = tcConfirmed;
    tester.tcPendingTotal = tcPending;
    tester.structuredReportsConfirmed = structuredReportsConfirmed;
    tester.lastActivityAt = new Date();
    return await this.armyTesterRepository.save(tester);
  }

  async getAllActiveTesters(): Promise<ArmyTester[]> {
    return await this.armyTesterRepository.find({
      where: { status: 'active' },
      relations: ['user'],
      order: { tcConfirmedTotal: 'DESC' },
    });
  }
}
