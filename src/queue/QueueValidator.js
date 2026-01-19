class QueueValidator {
  validate(product) {
    const errors = [];

    if (!product.art_cod_int) {
      errors.push('art_cod_int es requerido');
    }

    if (product.art_cod_int && product.art_cod_int.length > 100) {
      errors.push('art_cod_int excede longitud máxima (100 caracteres)');
    }

    if (!product.art_nombre && !product.art_nombre_web) {
      errors.push('art_nombre o art_nombre_web es requerido');
    }

    if (product.art_nombre && product.art_nombre.length > 200) {
      errors.push('art_nombre excede longitud máxima (200 caracteres)');
    }

    if (product.art_precio !== undefined && product.art_precio !== null) {
      const precio = parseFloat(product.art_precio);
      if (isNaN(precio)) {
        errors.push('art_precio debe ser numérico');
      } else if (precio < 0) {
        errors.push('art_precio no puede ser negativo');
      }
    }

    if (product.art_stock !== undefined && product.art_stock !== null) {
      const stock = parseInt(product.art_stock);
      if (isNaN(stock)) {
        errors.push('art_stock debe ser numérico');
      }
    }

    if (product.art_precio_oferta !== undefined && product.art_precio_oferta !== null) {
      const precioOferta = parseFloat(product.art_precio_oferta);
      if (!isNaN(precioOferta) && product.art_precio !== undefined) {
        const precio = parseFloat(product.art_precio);
        if (!isNaN(precio) && precioOferta > precio) {
          errors.push('art_precio_oferta no puede ser mayor que art_precio');
        }
      }
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  validateBatch(products) {
    const results = {
      valid: [],
      invalid: []
    };

    for (const product of products) {
      const validation = this.validate(product);

      if (validation.valid) {
        results.valid.push(product);
      } else {
        results.invalid.push({
          product,
          errors: validation.errors
        });
      }
    }

    return results;
  }
}

module.exports = QueueValidator;
