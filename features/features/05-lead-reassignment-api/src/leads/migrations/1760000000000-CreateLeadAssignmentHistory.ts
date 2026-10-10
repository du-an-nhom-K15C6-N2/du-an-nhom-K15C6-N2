import { MigrationInterface, QueryRunner, Table, TableIndex } from 'typeorm';

export class CreateLeadAssignmentHistory1760000000000
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('CREATE EXTENSION IF NOT EXISTS "uuid-ossp"');
    await queryRunner.createTable(
      new Table({
        name: 'lead_assignment_history',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            generationStrategy: 'uuid',
            default: 'uuid_generate_v4()',
          },
          { name: 'lead_id', type: 'uuid' },
          { name: 'from_assigned_to', type: 'uuid', isNullable: true },
          { name: 'to_assigned_to', type: 'uuid' },
          { name: 'changed_by', type: 'uuid' },
          { name: 'note', type: 'varchar', length: '500', isNullable: true },
          {
            name: 'created_at',
            type: 'timestamp with time zone',
            default: 'now()',
          },
        ],
      }),
    );

    await queryRunner.createIndex(
      'lead_assignment_history',
      new TableIndex({
        name: 'IDX_lead_assignment_history_lead_created',
        columnNames: ['lead_id', 'created_at'],
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('lead_assignment_history');
  }
}
