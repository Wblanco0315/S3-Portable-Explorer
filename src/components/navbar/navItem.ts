import { IconType } from "react-icons";

export default interface NavItem {
  name: string;
  path: string;
  icon?: IconType;
  children?: NavItem[];
  parent?: NavItem;
  isLink: boolean;
  badge?: number | string;
}
