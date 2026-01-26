const util = require('util');
const MySQLConnection = require('../database/mysql-connection');

class QueueProcessor {
  constructor(mysqlConfig, queue, logger) {
    this.queue = queue;
    this.logger = logger;
    this.maxRetries = parseInt(process.env.MAX_RETRY_ATTEMPTS) || 3;
    this.timeoutMs = parseInt(process.env.PROCESSING_TIMEOUT_MS) || 30000;

    this.mysqlConnection = new MySQLConnection(mysqlConfig, logger);
    this.pool = this.mysqlConnection.getPool();
    this.query = util.promisify(this.pool.query).bind(this.pool);
  }

  async initialize() {
    await this.mysqlConnection.testConnection();
  }

  async testConnection() {
    return await this.mysqlConnection.testConnection();
  }

  async processWithRetry(queueItem) {
    const { art_cod_int, product_data } = queueItem;

    for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
      try {
        this.queue.markAsProcessing(art_cod_int);

        const result = await this.processProductWithTransaction(product_data);

        this.queue.markAsCompleted(art_cod_int);

        return { success: true, result, attempts: attempt };

      } catch (error) {
        this.logger.error(`Error procesando ${art_cod_int} (intento ${attempt}/${this.maxRetries}):`, {
          error: error.message,
          stack: error.stack
        });

        this.queue.addError(
          art_cod_int,
          error.name || 'ProcessingError',
          error.message,
          error.stack
        );

        if (attempt < this.maxRetries) {
          const backoffMs = 1000 * Math.pow(2, attempt - 1);
          this.logger.info(`Reintentando ${art_cod_int} en ${backoffMs}ms...`);
          await this.sleep(backoffMs);
          this.queue.incrementAttempts(art_cod_int);
        } else {
          this.queue.markAsFailed(art_cod_int, error.message);
          return { success: false, error: error.message, attempts: attempt };
        }
      }
    }
  }

  async processProductWithTransaction(product) {
    const connection = await this.getConnection();

    try {
      await this.queryOnConnection(connection, 'START TRANSACTION');

      const postId = await this.getOrCreatePost(connection, product);
      await this.updatePostMeta(connection, postId, product);
      await this.updateStock(connection, postId, product);
      await this.updatePrice(connection, postId, product);

      if (product.art_imagen_url) {
        await this.updateProductImage(connection, postId, product.art_imagen_url);
      }

      await this.queryOnConnection(connection, 'COMMIT');

      this.logger.info(`Producto ${product.art_cod_int} procesado exitosamente (Post ID: ${postId})`);

      return { postId, success: true };

    } catch (error) {
      await this.queryOnConnection(connection, 'ROLLBACK');
      throw error;
    } finally {
      connection.release();
    }
  }

  async getOrCreatePost(connection, product) {
    const dbPrefix = process.env.DB_PREFIX || 'wp';

    const existingPost = await this.queryOnConnection(
      connection,
      `SELECT ID FROM ${dbPrefix}_posts WHERE post_name = ? AND post_type = 'product' LIMIT 1`,
      [this.sanitizeSlug(product.art_cod_int)]
    );

    if (existingPost.length > 0) {
      return existingPost[0].ID;
    }

    const postTitle = product.art_nombre_web || product.art_nombre || product.art_cod_int;
    const postContent = product.art_descripcion_larga || product.art_descripcion || '';
    const postExcerpt = product.art_descripcion || '';

    const insertResult = await this.queryOnConnection(
      connection,
      `INSERT INTO ${dbPrefix}_posts
      (post_author, post_date, post_date_gmt, post_content, post_title, post_excerpt,
       post_status, comment_status, ping_status, post_name, post_modified, post_modified_gmt,
       post_parent, guid, menu_order, post_type, comment_count)
      VALUES (1, NOW(), NOW(), ?, ?, ?, 'publish', 'open', 'closed', ?, NOW(), NOW(), 0, '', 0, 'product', 0)`,
      [postContent, postTitle, postExcerpt, this.sanitizeSlug(product.art_cod_int)]
    );

    return insertResult.insertId;
  }

  async updatePostMeta(connection, postId, product) {
    const dbPrefix = process.env.DB_PREFIX || 'wp';

    const metaData = [
      { key: '_sku', value: product.art_cod_int },
      { key: '_visibility', value: 'visible' },
      { key: '_stock_status', value: parseInt(product.art_stock) > 0 ? 'instock' : 'outofstock' },
      { key: '_manage_stock', value: 'yes' },
      { key: '_backorders', value: 'no' },
      { key: '_sold_individually', value: 'no' },
      { key: '_virtual', value: 'no' },
      { key: '_downloadable', value: 'no' },
      { key: '_tax_status', value: 'taxable' },
      { key: '_tax_class', value: '' },
      { key: 'total_sales', value: '0' }
    ];

    for (const meta of metaData) {
      await this.queryOnConnection(
        connection,
        `INSERT INTO ${dbPrefix}_postmeta (post_id, meta_key, meta_value)
         VALUES (?, ?, ?)
         ON DUPLICATE KEY UPDATE meta_value = ?`,
        [postId, meta.key, meta.value, meta.value]
      );
    }
  }

  async updateStock(connection, postId, product) {
    const dbPrefix = process.env.DB_PREFIX || 'wp';
    const stock = parseInt(product.art_stock) || 0;

    await this.queryOnConnection(
      connection,
      `INSERT INTO ${dbPrefix}_postmeta (post_id, meta_key, meta_value)
       VALUES (?, '_stock', ?)
       ON DUPLICATE KEY UPDATE meta_value = ?`,
      [postId, stock, stock]
    );
  }

  async updatePrice(connection, postId, product) {
    const dbPrefix = process.env.DB_PREFIX || 'wp';

    const regularPrice = parseFloat(product.art_precio) || 0;
    const salePrice = product.art_precio_oferta ? parseFloat(product.art_precio_oferta) : null;

    await this.queryOnConnection(
      connection,
      `INSERT INTO ${dbPrefix}_postmeta (post_id, meta_key, meta_value)
       VALUES (?, '_regular_price', ?)
       ON DUPLICATE KEY UPDATE meta_value = ?`,
      [postId, regularPrice, regularPrice]
    );

    if (salePrice !== null && salePrice < regularPrice) {
      await this.queryOnConnection(
        connection,
        `INSERT INTO ${dbPrefix}_postmeta (post_id, meta_key, meta_value)
         VALUES (?, '_sale_price', ?)
         ON DUPLICATE KEY UPDATE meta_value = ?`,
        [postId, salePrice, salePrice]
      );

      await this.queryOnConnection(
        connection,
        `INSERT INTO ${dbPrefix}_postmeta (post_id, meta_key, meta_value)
         VALUES (?, '_price', ?)
         ON DUPLICATE KEY UPDATE meta_value = ?`,
        [postId, salePrice, salePrice]
      );
    } else {
      await this.queryOnConnection(
        connection,
        `INSERT INTO ${dbPrefix}_postmeta (post_id, meta_key, meta_value)
         VALUES (?, '_price', ?)
         ON DUPLICATE KEY UPDATE meta_value = ?`,
        [postId, regularPrice, regularPrice]
      );
    }
  }

  async updateProductImage(connection, postId, imageUrl) {
    const dbPrefix = process.env.DB_PREFIX || 'wp';

    const existingAttachment = await this.queryOnConnection(
      connection,
      `SELECT ID FROM ${dbPrefix}_posts WHERE guid = ? AND post_type = 'attachment' LIMIT 1`,
      [imageUrl]
    );

    let attachmentId;

    if (existingAttachment.length > 0) {
      attachmentId = existingAttachment[0].ID;
    } else {
      const filename = imageUrl.split('/').pop();
      const insertResult = await this.queryOnConnection(
        connection,
        `INSERT INTO ${dbPrefix}_posts
         (post_author, post_date, post_date_gmt, post_content, post_title, post_excerpt,
          post_status, comment_status, ping_status, post_name, post_modified, post_modified_gmt,
          post_parent, guid, post_type, post_mime_type)
         VALUES (1, NOW(), NOW(), '', ?, '', 'inherit', 'open', 'closed', ?, NOW(), NOW(), ?, ?, 'attachment', 'image/jpeg')`,
        [filename, this.sanitizeSlug(filename), postId, imageUrl]
      );

      attachmentId = insertResult.insertId;
    }

    await this.queryOnConnection(
      connection,
      `INSERT INTO ${dbPrefix}_postmeta (post_id, meta_key, meta_value)
       VALUES (?, '_thumbnail_id', ?)
       ON DUPLICATE KEY UPDATE meta_value = ?`,
      [postId, attachmentId, attachmentId]
    );
  }

  sanitizeSlug(text) {
    return text
      .toString()
      .toLowerCase()
      .trim()
      .replace(/\s+/g, '-')
      .replace(/[^\w\-]+/g, '')
      .replace(/\-\-+/g, '-');
  }

  getConnection() {
    return new Promise((resolve, reject) => {
      this.pool.getConnection((err, connection) => {
        if (err) reject(err);
        else resolve(connection);
      });
    });
  }

  queryOnConnection(connection, sql, params = []) {
    return new Promise((resolve, reject) => {
      connection.query(sql, params, (err, results) => {
        if (err) reject(err);
        else resolve(results);
      });
    });
  }

  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  async close() {
    if (this.mysqlConnection) {
      await this.mysqlConnection.close();
    }
  }
}

module.exports = QueueProcessor;
