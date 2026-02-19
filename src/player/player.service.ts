import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { Player } from '../database/entities/player.entity';

@Injectable()
export class PlayerService {
  constructor(
    @InjectRepository(Player)
    private readonly playerRepository: Repository<Player>,
    private readonly dataSource: DataSource,
  ) {}

  async upsertPlayer(
    discordId: string,
    discordUsername: string,
    discordNickname?: string,
    playerId?: string,
    email?: string,
  ): Promise<Player> {
    const existingPlayer = await this.playerRepository.findOne({
      where: { discordId },
    });

    if (existingPlayer) {
      if (discordUsername) existingPlayer.discordUsername = discordUsername;
      if (discordNickname !== undefined) existingPlayer.discordNickname = discordNickname;
      if (playerId !== undefined) existingPlayer.playerId = playerId;
      if (email !== undefined) existingPlayer.email = email;
      existingPlayer.updatedAt = new Date();
      return await this.playerRepository.save(existingPlayer);
    }

    const newPlayer = this.playerRepository.create({
      discordId,
      discordUsername: discordUsername || null,
      discordNickname: discordNickname || null,
      playerId: playerId || null,
      email: email || null,
    });

    return await this.playerRepository.save(newPlayer);
  }

  async getPlayer(discordId: string): Promise<Player | null> {
    return await this.playerRepository.findOne({
      where: { discordId },
    });
  }

  async getPlayerByPlayerId(playerId: string): Promise<Player | null> {
    return await this.playerRepository.findOne({
      where: { playerId },
    });
  }

  async getPlayerByEmail(email: string): Promise<Player | null> {
    return await this.playerRepository.findOne({
      where: { email },
    });
  }

  /**
   * When user sets email via add-email, merge any other player(s) with same email
   * (e.g. temp_ from forms) into their Discord ID so submissions appear.
   */
  async mergePlayerByEmail(
    realDiscordId: string,
    email: string,
  ): Promise<{ merged: boolean }> {
    const others = await this.playerRepository.find({ where: { email } });
    let merged = false;
    for (const otherPlayer of others) {
      if (otherPlayer.discordId === realDiscordId) continue;
      const otherId = otherPlayer.discordId;
      const queryRunner = this.dataSource.createQueryRunner();
      await queryRunner.connect();
      await queryRunner.startTransaction();
      try {
        await queryRunner.query(
          `UPDATE army_testers SET discord_user_id = $1 WHERE discord_user_id = $2`,
          [realDiscordId, otherId],
        );
        await queryRunner.query(
          `UPDATE submissions SET discord_user_id = $1 WHERE discord_user_id = $2`,
          [realDiscordId, otherId],
        );
        await queryRunner.query(
          `UPDATE submissions SET reviewed_by = $1 WHERE reviewed_by = $2`,
          [realDiscordId, otherId],
        );
        await queryRunner.query(
          `UPDATE weekly_cycles SET created_by = $1 WHERE created_by = $2`,
          [realDiscordId, otherId],
        );
        await queryRunner.query(
          `UPDATE issues SET reporter_user_id = $1 WHERE reporter_user_id = $2`,
          [realDiscordId, otherId],
        );
        await queryRunner.query(
          `DELETE FROM players WHERE discord_id = $1`,
          [otherId],
        );
        await queryRunner.commitTransaction();
        merged = true;
      } catch (e) {
        await queryRunner.rollbackTransaction();
        throw e;
      } finally {
        await queryRunner.release();
      }
    }
    return { merged };
  }

  async getPlayerOrCreate(
    discordId: string,
    discordUsername: string,
    discordNickname?: string,
  ): Promise<Player> {
    const player = await this.getPlayer(discordId);
    if (player) {
      return player;
    }
    return await this.upsertPlayer(discordId, discordUsername, discordNickname);
  }

  /**
   * Resolve identifier to Discord ID
   * Email is primary identifier (consistent across builds). Then Player ID, then Discord ID.
   */
  async resolveToDiscordId(
    identifier: string,
    email?: string,
    createIfMissing: boolean = false,
  ): Promise<string | null> {
    // First try by email (primary - consistent across builds)
    if (email) {
      const playerByEmail = await this.getPlayerByEmail(email);
      if (playerByEmail) {
        if (!playerByEmail.playerId && identifier && !identifier.includes('@')) {
          playerByEmail.playerId = identifier;
          await this.playerRepository.save(playerByEmail);
        }
        return playerByEmail.discordId;
      }
    }
    if (identifier.includes('@')) {
      const playerByEmail = await this.getPlayerByEmail(identifier);
      if (playerByEmail) return playerByEmail.discordId;
    }

    // Then by Player ID (game ID - changes per build)
    const playerByGameId = await this.getPlayerByPlayerId(identifier);
    if (playerByGameId) return playerByGameId.discordId;

    // Then by Discord ID
    if (/^\d+$/.test(identifier)) {
      const playerByDiscordId = await this.getPlayer(identifier);
      if (playerByDiscordId) return identifier;
    }

    // Create placeholder if we have email
    // Note: This creates a player with a temporary Discord ID that needs to be updated later
    // when the actual Discord user joins
    if (createIfMissing && email) {
      // Generate a temporary Discord ID (we'll use a prefix to identify it)
      // In practice, you might want to use a different approach
      const tempDiscordId = `temp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      await this.upsertPlayer(
        tempDiscordId,
        email.split('@')[0], // Use email username as placeholder
        undefined,
        identifier,
        email,
      );
      return tempDiscordId;
    }

    return null;
  }

  // Helper method for backward compatibility with old code that uses discordUserId
  async upsertUser(
    discordUserId: string,
    discordUsername: string,
    displayName?: string,
  ): Promise<Player> {
    return await this.upsertPlayer(
      discordUserId,
      discordUsername,
      displayName || undefined,
    );
  }

  async getUser(discordUserId: string): Promise<Player | null> {
    return await this.getPlayer(discordUserId);
  }

  async getUserOrCreate(
    discordUserId: string,
    discordUsername: string,
    displayName?: string,
  ): Promise<Player> {
    return await this.getPlayerOrCreate(
      discordUserId,
      discordUsername,
      displayName,
    );
  }

  /**
   * Update player fields if they're missing
   */
  async updatePlayerFields(
    discordId: string,
    playerId?: string,
    email?: string,
  ): Promise<Player | null> {
    const player = await this.getPlayer(discordId);
    if (!player) {
      return null;
    }

    let needsUpdate = false;
    if (playerId !== undefined && !player.playerId && !discordId.startsWith('temp_')) {
      player.playerId = playerId;
      needsUpdate = true;
    }
    if (email !== undefined && !player.email) {
      player.email = email;
      needsUpdate = true;
    }

    if (needsUpdate) {
      player.updatedAt = new Date();
      return await this.playerRepository.save(player);
    }

    return player;
  }

  /**
   * Find and update temporary Discord ID to real Discord ID
   * This is used when a player joins Discord and we had created a placeholder for them
   * Uses raw SQL to update primary key and all foreign key references
   */
  async updateTempDiscordId(
    realDiscordId: string,
    email?: string,
    playerId?: string,
  ): Promise<Player | null> {
    // Try to find a player with temp Discord ID matching email or playerId
    let tempPlayer: Player | null = null;

    if (email) {
      tempPlayer = await this.playerRepository.findOne({
        where: { email },
      });
      if (tempPlayer && !tempPlayer.discordId.startsWith('temp_')) {
        tempPlayer = null;
      }
    }

    if (!tempPlayer && playerId) {
      tempPlayer = await this.playerRepository.findOne({
        where: { playerId },
      });
      if (tempPlayer && !tempPlayer.discordId.startsWith('temp_')) {
        tempPlayer = null;
      }
    }

    if (!tempPlayer) {
      return null;
    }

    const tempDiscordId = tempPlayer.discordId;

    // Check if real Discord ID already exists
    const existingRealPlayer = await this.getPlayer(realDiscordId);
    if (existingRealPlayer) {
      // Real player already exists, merge data
      if (tempPlayer.playerId && !existingRealPlayer.playerId) {
        existingRealPlayer.playerId = tempPlayer.playerId;
      }
      if (tempPlayer.email && !existingRealPlayer.email) {
        existingRealPlayer.email = tempPlayer.email;
      }
      existingRealPlayer.updatedAt = new Date();
      await this.playerRepository.save(existingRealPlayer);

      // Update all foreign key references from temp to real Discord ID
      const queryRunner = this.dataSource.createQueryRunner();
      await queryRunner.connect();
      await queryRunner.startTransaction();

      try {
        // Update references in all tables
        await queryRunner.query(
          `UPDATE army_testers SET discord_user_id = $1 WHERE discord_user_id = $2`,
          [realDiscordId, tempDiscordId],
        );
        await queryRunner.query(
          `UPDATE submissions SET discord_user_id = $1 WHERE discord_user_id = $2`,
          [realDiscordId, tempDiscordId],
        );
        await queryRunner.query(
          `UPDATE submissions SET reviewed_by = $1 WHERE reviewed_by = $2`,
          [realDiscordId, tempDiscordId],
        );
        await queryRunner.query(
          `UPDATE weekly_cycles SET created_by = $1 WHERE created_by = $2`,
          [realDiscordId, tempDiscordId],
        );
        await queryRunner.query(
          `UPDATE issues SET reporter_user_id = $1 WHERE reporter_user_id = $2`,
          [realDiscordId, tempDiscordId],
        );

        // Delete temp player
        await queryRunner.query(
          `DELETE FROM players WHERE discord_id = $1`,
          [tempDiscordId],
        );

        await queryRunner.commitTransaction();
        return existingRealPlayer;
      } catch (error) {
        await queryRunner.rollbackTransaction();
        throw error;
      } finally {
        await queryRunner.release();
      }
    } else {
      // No existing real player, update temp player's Discord ID using raw SQL
      const queryRunner = this.dataSource.createQueryRunner();
      await queryRunner.connect();
      await queryRunner.startTransaction();

      try {
        // Update references in all tables first
        await queryRunner.query(
          `UPDATE army_testers SET discord_user_id = $1 WHERE discord_user_id = $2`,
          [realDiscordId, tempDiscordId],
        );
        await queryRunner.query(
          `UPDATE submissions SET discord_user_id = $1 WHERE discord_user_id = $2`,
          [realDiscordId, tempDiscordId],
        );
        await queryRunner.query(
          `UPDATE submissions SET reviewed_by = $1 WHERE reviewed_by = $2`,
          [realDiscordId, tempDiscordId],
        );
        await queryRunner.query(
          `UPDATE weekly_cycles SET created_by = $1 WHERE created_by = $2`,
          [realDiscordId, tempDiscordId],
        );
        await queryRunner.query(
          `UPDATE issues SET reporter_user_id = $1 WHERE reporter_user_id = $2`,
          [realDiscordId, tempDiscordId],
        );

        // Update primary key in players table
        await queryRunner.query(
          `UPDATE players SET discord_id = $1, updated_at = NOW() WHERE discord_id = $2`,
          [realDiscordId, tempDiscordId],
        );

        await queryRunner.commitTransaction();

        // Return updated player
        return await this.getPlayer(realDiscordId);
      } catch (error) {
        await queryRunner.rollbackTransaction();
        throw error;
      } finally {
        await queryRunner.release();
      }
    }
  }
}
