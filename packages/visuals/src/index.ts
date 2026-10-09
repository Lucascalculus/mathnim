// @mathnim/visuals - parametric, pre-verified explanation scenes ("visuals")
// shared by authored lessons and AI answers, the catalog the AI chooses from,
// and the named-colour themes they are drawn with.
import { circle_slices } from './geometry/circle_slices';
import { register } from './registry';
import { linear_map } from './linalg/linear_map';
import { determinant_area } from './linalg/determinant_area';
import { eigen_hunt } from './linalg/eigen_hunt';
import { lambda_sweep } from './linalg/lambda_sweep';
import { rotation_no_eigen } from './linalg/rotation_no_eigen';
import { matrix_power } from './linalg/matrix_power';
import { symmetric_ellipse } from './linalg/symmetric_ellipse';
import { covariance_ellipse } from './linalg/covariance_ellipse';
import { pca_projection } from './linalg/pca_projection';
import { pca_3d } from './linalg/pca_3d';

export { define_visual, type ParamSpec, type ParamSpecs, type Params, type Visual } from './visual';
export { check_params, describe_param, type ParamCheck } from './params';
export { catalog, get_visual, list_visuals, register } from './registry';
export { THEMES, apply_palette, palette, set_theme, theme, type Palette, type ThemeName } from './theme';
export { circle_slices, lined_up_width, slices } from './geometry/circle_slices';

export * as linalg from './linalg';
export { linear_map } from './linalg/linear_map';
export { determinant_area } from './linalg/determinant_area';
export { eigen_hunt } from './linalg/eigen_hunt';
export { lambda_sweep } from './linalg/lambda_sweep';
export { rotation_no_eigen } from './linalg/rotation_no_eigen';
export { matrix_power } from './linalg/matrix_power';
export { symmetric_ellipse } from './linalg/symmetric_ellipse';
export { covariance_ellipse } from './linalg/covariance_ellipse';
export { pca_projection } from './linalg/pca_projection';
export { pca_3d } from './linalg/pca_3d';

register(circle_slices);
register(linear_map, determinant_area, eigen_hunt, lambda_sweep, rotation_no_eigen, matrix_power, symmetric_ellipse, covariance_ellipse, pca_projection, pca_3d);

// The LLM fine-tuning course's visuals are not here: each part's index
// (src/ft/<part>/index.ts) registers its visuals when imported, which the app
// does when a lesson of that part is opened (apps/mathnim/src/lessons/ft/
// manifest.generated.ts), so the home page and the math course never download
// them or their data. The tools import the part indexes themselves.
