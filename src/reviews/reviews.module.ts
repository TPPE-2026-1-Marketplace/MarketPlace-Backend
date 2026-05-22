import { Module } from "@nestjs/common";

import { TypeOrmModule } from "@nestjs/typeorm";
import { ReviewsController } from "./reviews.controller";
import { ReviewsService } from "./reviews.service";
import { Review } from "./entities/review.entity";
import { Person } from "../people/entities/person.entity";
import { Product } from "../products/entities/product.entity";
import { Order } from "../orders/entities/order.entity";

@Module({
  imports: [TypeOrmModule.forFeature([Review, Person, Product, Order])],
  controllers: [ReviewsController],
  providers: [ReviewsService],
  exports: [ReviewsService],
})
export class ReviewsModule {}
