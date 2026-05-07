import { User } from './user.entity';
export declare class SystemSettings {
    settingKey: string;
    settingValue: string;
    updatedAt: Date;
    updatedBy: User | null;
}
