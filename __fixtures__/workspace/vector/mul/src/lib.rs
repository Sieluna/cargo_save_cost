#![no_std]

use mul::mul;
use vector_types::{Vector2, Vector3, Vector4};

pub fn mul_vector_2d(v1: Vector2, v2: Vector2) -> Vector2 {
    Vector2 {
        x: mul(v1.x, v2.x),
        y: mul(v1.y, v2.y),
    }
}

pub fn mul_vector_3d(v1: Vector3, v2: Vector3) -> Vector3 {
    Vector3 {
        x: mul(v1.x, v2.x),
        y: mul(v1.y, v2.y),
        z: mul(v1.z, v2.z),
    }
}

pub fn mul_vector_4d(v1: Vector4, v2: Vector4) -> Vector4 {
    Vector4 {
        x: mul(v1.x, v2.x),
        y: mul(v1.y, v2.y),
        z: mul(v1.z, v2.z),
        w: mul(v1.w, v2.w),
    }
}

// Scalar multiplication
pub fn mul_vector_scalar_2d(v: Vector2, scalar: f64) -> Vector2 {
    Vector2 {
        x: mul(v.x, scalar),
        y: mul(v.y, scalar),
    }
}

pub fn mul_vector_scalar_3d(v: Vector3, scalar: f64) -> Vector3 {
    Vector3 {
        x: mul(v.x, scalar),
        y: mul(v.y, scalar),
        z: mul(v.z, scalar),
    }
}

pub fn mul_vector_scalar_4d(v: Vector4, scalar: f64) -> Vector4 {
    Vector4 {
        x: mul(v.x, scalar),
        y: mul(v.y, scalar),
        z: mul(v.z, scalar),
        w: mul(v.w, scalar),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_mul_vector_2d() {
        assert_eq!(
            mul_vector_2d(Vector2::new(2.0, 3.0), Vector2::new(4.0, 5.0)),
            Vector2::new(8.0, 15.0)
        );
    }

    #[test]
    fn test_mul_vector_3d() {
        assert_eq!(
            mul_vector_3d(Vector3::new(2.0, 3.0, 4.0), Vector3::new(5.0, 6.0, 7.0)),
            Vector3::new(10.0, 18.0, 28.0)
        );
    }

    #[test]
    fn test_mul_vector_4d() {
        assert_eq!(
            mul_vector_4d(
                Vector4::new(2.0, 3.0, 4.0, 5.0),
                Vector4::new(6.0, 7.0, 8.0, 9.0)
            ),
            Vector4::new(12.0, 21.0, 32.0, 45.0)
        );
    }

    #[test]
    fn test_mul_vector_scalar_2d() {
        assert_eq!(
            mul_vector_scalar_2d(Vector2::new(2.0, 3.0), 4.0),
            Vector2::new(8.0, 12.0)
        );
    }
}
