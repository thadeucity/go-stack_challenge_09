import { inject, injectable } from 'tsyringe';

import { isUuid } from 'uuidv4';

import AppError from '@shared/errors/AppError';

import IProductsRepository from '@modules/products/repositories/IProductsRepository';
import ICustomersRepository from '@modules/customers/repositories/ICustomersRepository';
import Order from '../infra/typeorm/entities/Order';
import IOrdersRepository from '../repositories/IOrdersRepository';

interface IProduct {
  id: string;
  quantity: number;
}

interface IRequest {
  customer_id: string;
  products: IProduct[];
}

@injectable()
class CreateProductService {
  constructor(
    @inject('OrdersRepository')
    private ordersRepository: IOrdersRepository,

    @inject('ProductsRepository')
    private productsRepository: IProductsRepository,

    @inject('CustomersRepository')
    private customersRepository: ICustomersRepository,
  ) {}

  public async execute({ customer_id, products }: IRequest): Promise<Order> {
    if (!isUuid(customer_id)) {
      throw new AppError('Invalid customer ID');
    }

    const customer = await this.customersRepository.findById(customer_id);

    if (!customer) {
      throw new AppError('You cannot create an order for a non-existing user');
    }

    const foundProducts = await this.productsRepository.findAllById(products);

    if (foundProducts.length < products.length) {
      throw new AppError(
        'One of the products you are trying to order does not exist',
        400,
      );
    }

    const orderProducts = foundProducts.map(product => {
      const productFromRequest = products.find(prod => prod.id === product.id);

      if (!productFromRequest) {
        throw new AppError(
          'Something really strange just happened try again later',
          400,
        );
      }

      if (productFromRequest.quantity > product.quantity) {
        throw new AppError(
          'One of the products you are trying to order does not have enough stock',
        );
      }

      return {
        product_id: product.id,
        quantity: productFromRequest.quantity,
        newStock: product.quantity - productFromRequest.quantity,
        price: product.price,
      };
    });

    const order = await this.ordersRepository.create({
      customer,
      products: orderProducts,
    });

    if (order) {
      const productsStatusAfterOder = orderProducts.map(product => ({
        id: product.product_id,
        quantity: product.newStock,
      }));
      await this.productsRepository.updateQuantity(productsStatusAfterOder); // CORRIGIR, ESTÀ MUITO ERRADO
    }

    return order;
  }
}

export default CreateProductService;
