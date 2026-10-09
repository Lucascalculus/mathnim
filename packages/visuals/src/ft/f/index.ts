// Part F of the fine-tuning course (how to choose): the course-wide decision map.
import { register } from '../../registry';
import { decision_map } from './decision_map';

export { decision_map } from './decision_map';
export { CARDS, HEADERS, LESSONS, NODES, node_id, node_list, type LessonId, type MapNode } from './map_data';
export { label, box, fit, pick, set_ft_lang, ft_lang, resolve_lang, type Lang } from './kit';

register(decision_map);
