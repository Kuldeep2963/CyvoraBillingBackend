module.exports = {
  async up(queryInterface, Sequelize) {
    const tables = await queryInterface.showAllTables();
    const normalizedTables = tables.map((table) => String(table).toLowerCase());

    if (!normalizedTables.includes('notifications')) {
      console.log('Skipping 010 migration: notifications table does not exist yet');
      return;
    }

    const hasNotificationReads = normalizedTables.includes('notification_reads');

    if (!hasNotificationReads) {
      await queryInterface.createTable('notification_reads', {
        id: {
          type: Sequelize.BIGINT,
          allowNull: false,
          autoIncrement: true,
          primaryKey: true,
        },
        notification_id: {
          type: Sequelize.STRING,
          allowNull: false,
          references: {
            model: 'notifications',
            key: 'id',
          },
          onUpdate: 'CASCADE',
          onDelete: 'CASCADE',
        },
        user_id: {
          type: Sequelize.INTEGER,
          allowNull: false,
        },
        read_at: {
          type: Sequelize.DATE,
          allowNull: false,
          defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
        },
        createdAt: {
          type: Sequelize.DATE,
          allowNull: false,
          defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
        },
        updatedAt: {
          type: Sequelize.DATE,
          allowNull: false,
          defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
        },
      });
    }

    const notificationReadsIndexes = await queryInterface.showIndex('notification_reads');
    const notificationReadsIndexNames = new Set(notificationReadsIndexes.map((index) => index.name));

    if (!notificationReadsIndexNames.has('notification_reads_notification_user_unique')) {
      await queryInterface.addIndex('notification_reads', ['notification_id', 'user_id'], {
        name: 'notification_reads_notification_user_unique',
        unique: true,
      });
    }

    if (!notificationReadsIndexNames.has('notification_reads_user_read_at_idx')) {
      await queryInterface.addIndex('notification_reads', ['user_id', 'read_at'], {
        name: 'notification_reads_user_read_at_idx',
      });
    }

    const notificationIndexes = await queryInterface.showIndex('notifications');
    const notificationIndexNames = new Set(notificationIndexes.map((index) => index.name));

    if (!notificationIndexNames.has('notifications_created_at_idx')) {
      await queryInterface.addIndex('notifications', ['createdAt'], {
        name: 'notifications_created_at_idx',
      });
    }

    if (!notificationIndexNames.has('notifications_audience_role_created_at_idx')) {
      await queryInterface.addIndex('notifications', ['audience_role', 'createdAt'], {
        name: 'notifications_audience_role_created_at_idx',
      });
    }

    if (!notificationIndexNames.has('notifications_is_read_idx')) {
      await queryInterface.addIndex('notifications', ['isRead'], {
        name: 'notifications_is_read_idx',
      });
    }
  },

  async down(queryInterface) {
    const tables = await queryInterface.showAllTables();
    const normalizedTables = tables.map((table) => String(table).toLowerCase());

    if (normalizedTables.includes('notifications')) {
      const notificationIndexes = await queryInterface.showIndex('notifications');
      const notificationIndexNames = new Set(notificationIndexes.map((index) => index.name));

      if (notificationIndexNames.has('notifications_is_read_idx')) {
        await queryInterface.removeIndex('notifications', 'notifications_is_read_idx');
      }
      if (notificationIndexNames.has('notifications_audience_role_created_at_idx')) {
        await queryInterface.removeIndex('notifications', 'notifications_audience_role_created_at_idx');
      }
      if (notificationIndexNames.has('notifications_created_at_idx')) {
        await queryInterface.removeIndex('notifications', 'notifications_created_at_idx');
      }
    }

    if (normalizedTables.includes('notification_reads')) {
      const notificationReadsIndexes = await queryInterface.showIndex('notification_reads');
      const notificationReadsIndexNames = new Set(notificationReadsIndexes.map((index) => index.name));

      if (notificationReadsIndexNames.has('notification_reads_user_read_at_idx')) {
        await queryInterface.removeIndex('notification_reads', 'notification_reads_user_read_at_idx');
      }
      if (notificationReadsIndexNames.has('notification_reads_notification_user_unique')) {
        await queryInterface.removeIndex('notification_reads', 'notification_reads_notification_user_unique');
      }

      await queryInterface.dropTable('notification_reads');
    }
  },
};
