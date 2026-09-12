CREATE TABLE `environment_readings` (
	`id` int AUTO_INCREMENT NOT NULL,
	`station` varchar(32) NOT NULL,
	`timestamp` timestamp NOT NULL,
	`temperature_c` double NOT NULL,
	`humidity_percent` double NOT NULL,
	`pressure_mbar` double NOT NULL,
	`wind_speed_knots` double NOT NULL,
	`source` varchar(32) NOT NULL DEFAULT 'NCPOR',
	`data_type` enum('REAL','SIMULATED') NOT NULL DEFAULT 'REAL',
	CONSTRAINT `environment_readings_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `users` (
	`id` int AUTO_INCREMENT NOT NULL,
	`openId` varchar(64) NOT NULL,
	`name` text,
	`email` varchar(320),
	`loginMethod` varchar(64),
	`role` enum('user','admin') NOT NULL DEFAULT 'user',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	`lastSignedIn` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `users_id` PRIMARY KEY(`id`),
	CONSTRAINT `users_openId_unique` UNIQUE(`openId`)
);
