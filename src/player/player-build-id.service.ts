import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PlayerBuildId } from '../database/entities/player-build-id.entity';

export const BUILD_VERSIONS = ['2.10', '2.11', '2.12', '2.13', '2.14', '2.15', '2.16', '2.17'] as const;
export type BuildVersion = (typeof BUILD_VERSIONS)[number];

@Injectable()
export class PlayerBuildIdService {
  constructor(
    @InjectRepository(PlayerBuildId)
    private readonly repo: Repository<PlayerBuildId>,
  ) {}

  /**
   * Set or update in-game player ID for a Discord user and build.
   * Email is available via the players table (discord_id).
   */
  async setPlayerIdForBuild(
    discordId: string,
    buildVersion: string,
    playerId: string,
  ): Promise<PlayerBuildId> {
    let row = await this.repo.findOne({
      where: { discordId, buildVersion },
    });
    if (row) {
      row.playerId = playerId.trim();
      return await this.repo.save(row);
    }
    row = this.repo.create({
      discordId,
      buildVersion,
      playerId: playerId.trim(),
    });
    return await this.repo.save(row);
  }

  /**
   * Get in-game player ID for a Discord user and build (if set).
   */
  async getPlayerIdForBuild(
    discordId: string,
    buildVersion: string,
  ): Promise<string | null> {
    const row = await this.repo.findOne({
      where: { discordId, buildVersion },
    });
    return row?.playerId ?? null;
  }

  /**
   * Find Discord user (and thus email via Player) by build and in-game player ID.
   */
  async getDiscordIdByBuildAndPlayerId(
    buildVersion: string,
    playerId: string,
  ): Promise<string | null> {
    const row = await this.repo.findOne({
      where: { buildVersion, playerId: playerId.trim() },
    });
    return row?.discordId ?? null;
  }

  /**
   * List all build→playerId entries for a Discord user.
   */
  async listByDiscordId(discordId: string): Promise<PlayerBuildId[]> {
    return await this.repo.find({
      where: { discordId },
      order: { buildVersion: 'ASC' },
    });
  }
}
