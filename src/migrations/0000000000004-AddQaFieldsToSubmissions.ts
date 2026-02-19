import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddQaFieldsToSubmissions0000000000004 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    const submissionsTable = await queryRunner.getTable('submissions');
    
    if (submissionsTable) {
      // Add qa_status column
      const qaStatusColumn = submissionsTable.findColumnByName('qa_status');
      if (!qaStatusColumn) {
        await queryRunner.query(`
          ALTER TABLE submissions 
          ADD COLUMN qa_status TEXT
        `);
      }

      // Add qa_build_version column
      const qaBuildVersionColumn = submissionsTable.findColumnByName('qa_build_version');
      if (!qaBuildVersionColumn) {
        await queryRunner.query(`
          ALTER TABLE submissions 
          ADD COLUMN qa_build_version TEXT
        `);
      }
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const submissionsTable = await queryRunner.getTable('submissions');
    
    if (submissionsTable) {
      // Remove qa_status column
      const qaStatusColumn = submissionsTable.findColumnByName('qa_status');
      if (qaStatusColumn) {
        await queryRunner.dropColumn('submissions', 'qa_status');
      }

      // Remove qa_build_version column
      const qaBuildVersionColumn = submissionsTable.findColumnByName('qa_build_version');
      if (qaBuildVersionColumn) {
        await queryRunner.dropColumn('submissions', 'qa_build_version');
      }
    }
  }
}
