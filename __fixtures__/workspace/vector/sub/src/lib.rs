#![no_std]

use sub::sub;
use vector_types::{Vector2, Vector3, Vector4};

pub fn sub_vector_2d(v1: Vector2, v2: Vector2) -> Vector2 {
    Vector2 {
        x: sub(v1.x, v2.x),
        y: sub(v1.y, v2.y),
    }
}

pub fn sub_vector_3d(v1: Vector3, v2: Vector3) -> Vector3 {
    Vector3 {
        x: sub(v1.x, v2.x),
        y: sub(v1.y, v2.y),
        z: sub(v1.z, v2.z),
    }
}

pub fn sub_vector_4d(v1: Vector4, v2: Vector4) -> Vector4 {
    Vector4 {
        x: sub(v1.x, v2.x),
        y: sub(v1.y, v2.y),
        z: sub(v1.z, v2.z),
        w: sub(v1.w, v2.w),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_sub_vector_2d() {
        assert_eq!(
            sub_vector_2d(Vector2::new(5.0, 8.0), Vector2::new(2.0, 3.0)),
            Vector2::new(3.0, 5.0)
        );
    }

    #[test]
    fn test_sub_vector_3d() {
        assert_eq!(
            sub_vector_3d(Vector3::new(10.0, 15.0, 20.0), Vector3::new(3.0, 5.0, 7.0)),
            Vector3::new(7.0, 10.0, 13.0)
        );
    }

    #[test]
    fn test_sub_vector_4d() {
        assert_eq!(
            sub_vector_4d(
                Vector4::new(20.0, 30.0, 40.0, 50.0),
                Vector4::new(5.0, 10.0, 15.0, 20.0)
            ),
            Vector4::new(15.0, 20.0, 25.0, 30.0)
        );
    }
}
