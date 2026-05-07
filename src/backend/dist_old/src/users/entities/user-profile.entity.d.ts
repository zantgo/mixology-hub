import { User } from './user.entity';
export declare class UserProfile {
    id: string;
    user: User;
    unitSystem: string;
    theme: string;
    defaultServings: number;
    defaultPartSize: number;
    showTutorial: boolean;
}
