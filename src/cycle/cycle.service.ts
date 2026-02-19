import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import { WeeklyCycle, CycleStatus } from '../database/entities/weekly-cycle.entity';

@Injectable()
export class CycleService {
  constructor(
    @InjectRepository(WeeklyCycle)
    private readonly cycleRepository: Repository<WeeklyCycle>,
  ) {}

  /**
   * Launch a new build. Closes the previous active build and creates a new one.
   * Build start date = when launched. Previous build ends only when this is called.
   */
  async launchNewBuild(data: {
    buildVersion: string;
    appStoreLink: string;
    googlePlayLink: string;
    createdBy?: string;
  }): Promise<WeeklyCycle> {
    const now = new Date();

    // Close previous active build (no fixed end date - ends when new build launches)
    const previous = await this.getActiveCycle();
    if (previous) {
      previous.closedAt = now;
      previous.status = 'closed';
      await this.cycleRepository.save(previous);
    }

    const cycle = this.cycleRepository.create({
      buildVersion: data.buildVersion,
      buildLink: data.appStoreLink, // legacy field, use app store as primary
      appStoreLink: data.appStoreLink,
      googlePlayLink: data.googlePlayLink,
      weekStart: now,
      weekEnd: now, // placeholder - will be set when next build launches
      closedAt: null,
      status: 'published',
      createdBy: data.createdBy || null,
      quickMissionsJson: [],
    });

    return await this.cycleRepository.save(cycle);
  }

  async createCycle(data: {
    buildVersion: string;
    buildLink: string;
    weekStart: Date;
    weekEnd: Date;
    createdBy?: string;
  }): Promise<WeeklyCycle> {
    const cycle = this.cycleRepository.create({
      buildVersion: data.buildVersion,
      buildLink: data.buildLink,
      appStoreLink: null,
      googlePlayLink: null,
      closedAt: null,
      weekStart: data.weekStart,
      weekEnd: data.weekEnd,
      status: 'draft',
      createdBy: data.createdBy || null,
      quickMissionsJson: [],
    });

    return await this.cycleRepository.save(cycle);
  }

  async setMissions(
    cycleId: string,
    quickMissions: any[],
    advancedMission?: any,
  ): Promise<WeeklyCycle> {
    const cycle = await this.cycleRepository.findOne({
      where: { id: cycleId },
    });

    if (!cycle) {
      throw new Error(`Cycle ${cycleId} not found`);
    }

    cycle.quickMissionsJson = quickMissions;
    if (advancedMission) {
      cycle.advancedMissionJson = advancedMission;
    }

    return await this.cycleRepository.save(cycle);
  }

  async publishCycle(cycleId: string): Promise<WeeklyCycle> {
    const cycle = await this.cycleRepository.findOne({
      where: { id: cycleId },
    });

    if (!cycle) {
      throw new Error(`Cycle ${cycleId} not found`);
    }

    cycle.status = 'published';
    return await this.cycleRepository.save(cycle);
  }

  async closeCycle(cycleId: string): Promise<WeeklyCycle> {
    const cycle = await this.cycleRepository.findOne({
      where: { id: cycleId },
    });

    if (!cycle) {
      throw new Error(`Cycle ${cycleId} not found`);
    }

    cycle.status = 'closed';
    return await this.cycleRepository.save(cycle);
  }

  async getActiveCycle(): Promise<WeeklyCycle | null> {
    // Active = published and not yet closed (closed_at is null)
    return await this.cycleRepository.findOne({
      where: {
        status: 'published',
        closedAt: IsNull(),
      },
      order: { weekStart: 'DESC' },
    });
  }

  async getCycle(cycleId: string): Promise<WeeklyCycle | null> {
    return await this.cycleRepository.findOne({
      where: { id: cycleId },
    });
  }

  async getAllCycles(): Promise<WeeklyCycle[]> {
    return await this.cycleRepository.find({
      order: { weekStart: 'DESC' },
    });
  }
}
